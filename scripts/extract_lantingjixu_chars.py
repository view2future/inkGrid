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
class ColumnCropBounds:
    """Per-column crop clamp bounds.

    Policy: prefer not-clipped. Allow expansion into column gaps up to the
    midline between adjacent columns (right/left neighbors).
    """

    col: ColumnBox
    safe_x0: int
    safe_x1: int


@dataclass
class RowCropBounds:
    """Per-row crop clamp bounds within a column.

    Policy: never allow y-expansion to cross the midline between adjacent cells.
    This prevents "cross-cell swallow" where a crop box absorbs strokes from the
    previous/next character and causes mislabel/near-duplicate outputs.
    """

    cell: CharBox
    safe_y0: int
    safe_y1: int


@dataclass
class CharBox:
    x0: int
    y0: int
    x1: int
    y1: int


@dataclass(frozen=True)
class ContactInk:
    total: int
    left: int
    right: int
    top: int
    bottom: int


def expand_crop_box_by_contact(
    page_ink: np.ndarray,
    *,
    crop_box: list[int],
    safe_x0: int,
    safe_x1: int,
    safe_y0: int,
    safe_y1: int,
    img_h: int,
    ring_px: int = 8,
    accept: int = 15,
    trigger: int = 12,
    max_iter: int = 6,
) -> list[int]:
    """Expand crop_box by directional contact, clamped to safe bounds.

    Policy: prefer not clipped. Expands into gaps up to column midlines.
    """

    x0, y0, x1, y1 = (int(crop_box[0]), int(crop_box[1]), int(crop_box[2]), int(crop_box[3]))
    x0 = max(int(safe_x0), x0)
    x1 = min(int(safe_x1), x1)
    y0 = max(int(safe_y0), y0)
    y1 = min(int(safe_y1), y1)
    if x1 <= x0 + 1 or y1 <= y0 + 1:
        return [x0, y0, x1, y1]

    step_x = 8
    step_y = 14

    for _ in range(int(max_iter)):
        c = contact_ring_ink_directional(
            page_ink,
            crop_box=[x0, y0, x1, y1],
            ring_px=int(ring_px),
            band_ratio=0.6,
        )
        if c.total <= int(accept):
            break

        # Expand the most likely clipped direction(s).
        dirs = [
            (c.left, "left"),
            (c.right, "right"),
            (c.top, "top"),
            (c.bottom, "bottom"),
        ]
        dirs.sort(reverse=True)
        max_v, _ = dirs[0]
        if int(max_v) < int(trigger):
            break

        for v, name in dirs:
            if int(v) < int(trigger):
                continue
            if name == "left" and x0 > int(safe_x0):
                x0 = max(int(safe_x0), int(x0 - step_x))
            elif name == "right" and x1 < int(safe_x1):
                x1 = min(int(safe_x1), int(x1 + step_x))
            elif name == "top" and y0 > int(safe_y0):
                y0 = max(int(safe_y0), int(y0 - step_y))
            elif name == "bottom" and y1 < int(safe_y1):
                y1 = min(int(safe_y1), int(y1 + step_y))

        # If nothing changes, stop.
        if (
            (c.left < int(trigger) or x0 == int(safe_x0))
            and (c.right < int(trigger) or x1 == int(safe_x1))
            and (c.top < int(trigger) or y0 == int(safe_y0))
            and (c.bottom < int(trigger) or y1 == int(safe_y1))
        ):
            break

    return [int(x0), int(y0), int(x1), int(y1)]


def compute_safe_row_bounds(cells: list[CharBox], img_h: int) -> list[RowCropBounds]:
    """Compute per-row safe y-bounds within a column.

    Cells are expected in top-to-bottom order.
    """

    if not cells:
        return []

    # Small "bleed" margin: allow cursive stroke tails to cross slightly,
    # but still prevent large cross-cell swallow.
    #
    # Make it proportional to average cell height to reduce clipping on columns
    # with larger steps.
    height = max(1, int(cells[-1].y1) - int(cells[0].y0))
    step = height / float(len(cells))
    bleed = int(max(12, min(28, round(step * 0.12))))

    out: list[RowCropBounds] = []
    n = len(cells)
    for i, cell in enumerate(cells):
        if i == 0:
            safe_y0 = 0
        else:
            prev = cells[i - 1]
            safe_y0 = int(round((prev.y1 + cell.y0) / 2.0)) - int(bleed)

        if i == n - 1:
            safe_y1 = int(img_h)
        else:
            nxt = cells[i + 1]
            safe_y1 = int(round((cell.y1 + nxt.y0) / 2.0)) + int(bleed)

        safe_y0 = int(max(0, min(safe_y0, img_h - 1)))
        safe_y1 = int(max(safe_y0 + 1, min(safe_y1, img_h)))
        out.append(RowCropBounds(cell=cell, safe_y0=safe_y0, safe_y1=safe_y1))
    return out


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
    detected_cols_by_page: list[list[ColumnBox]] = []
    for p in image_paths:
        img = Image.open(p).convert("RGB")
        arr = np.array(img)
        ink = ink_mask(arr, ink_threshold=int(args.ink_threshold))
        cols_detected = detect_columns(ink)
        if not cols_detected:
            raise SystemExit(f"Failed to detect columns for {p.name}")
        cols_expanded = expand_columns(
            cols_detected, img.width, pad_ratio=float(args.col_pad)
        )
        detected_cols_by_page.append(cols_detected)
        col_boxes_by_page.append(cols_expanded)

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

        loose_thr = min(255, int(args.bbox_ink_threshold) + 35)
        page_ink_loose = ink_mask(arr, ink_threshold=int(loose_thr))

        # Debug overlay
        overlay: Image.Image | None = None
        draw: ImageDraw.ImageDraw | None = None
        if args.debug:
            overlay = img.copy()
            draw = ImageDraw.Draw(overlay)

        # Reading order: rightmost column first.
        # Our detect_columns returns left->right segments; reverse.
        col_boxes_sorted = sorted(col_boxes, key=lambda b: b.x0, reverse=True)
        detected_sorted = sorted(
            detected_cols_by_page[page_i - 1], key=lambda b: b.x0, reverse=True
        )

        col_bounds = compute_safe_column_bounds(
            col_boxes_sorted, detected_sorted, img.width
        )

        for col_in_page, cb in enumerate(col_bounds):
            col_box = cb.col
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

            row_bounds = compute_safe_row_bounds(char_boxes, img.height)

            for row_in_col, (ch, rb) in enumerate(zip(chars, row_bounds, strict=True)):
                box = rb.cell
                global_idx += 1

                cell_w = max(1, box.x1 - box.x0)
                cell_h = max(1, box.y1 - box.y0)

                # Context crop around the cell, clamped within the column.
                # If the glyph bbox touches too many edges, retry with larger context.
                # Ensure these are always defined for metadata output.
                ctx_x0 = int(box.x0)
                ctx_y0 = int(box.y0)
                ctx_x1 = int(box.x1)
                ctx_y1 = int(box.y1)

                crop_final: Image.Image = img.crop((ctx_x0, ctx_y0, ctx_x1, ctx_y1))
                ink_bbox: list[int] | None = None
                quality: dict = {"is_empty": True, "edge_touch": 4}

                bbox_pad_base = max(
                    2, int(round(min(cell_w, cell_h) * float(args.bbox_pad)))
                )

                extra_left = 0
                extra_right = 0
                extra_top = 0
                extra_bottom = 0

                # Prefer not clipped: keep retrying if outer ring contact persists.
                contact_accept = 25
                contact_dir_trigger = 28
                extra_step = 10

                for attempt in range(6):
                    # Attempts 0..2: grow context gradually.
                    # Attempt 3+: fall back to full safe column width.
                    if attempt >= 3:
                        ctx_scale = 1.0 + 0.40 * 2.0
                        pad_scale = 1.0 + 0.55 * 3.0
                    else:
                        ctx_scale = 1.0 + 0.40 * float(attempt)
                        pad_scale = 1.0 + 0.55 * float(attempt)

                    ctx_px_x = int(round(cell_w * float(args.context_pad) * ctx_scale))
                    ctx_px_y = int(round(cell_h * float(args.context_pad) * ctx_scale))
                    if attempt >= 3:
                        ctx_x0 = int(cb.safe_x0)
                        ctx_x1 = int(cb.safe_x1)
                        # Prefer not clipped: allow more vertical context on the final attempt.
                        ctx_px_y = int(round(ctx_px_y * 2.2))
                    else:
                        ctx_x0 = max(int(cb.safe_x0), int(box.x0) - ctx_px_x)
                        ctx_x1 = min(int(cb.safe_x1), int(box.x1) + ctx_px_x)

                    ctx_x0 = max(int(cb.safe_x0), int(ctx_x0) - int(extra_left))
                    ctx_x1 = min(int(cb.safe_x1), int(ctx_x1) + int(extra_right))
                    ctx_y0 = max(int(rb.safe_y0), int(box.y0) - ctx_px_y - int(extra_top))
                    ctx_y1 = min(int(rb.safe_y1), int(box.y1) + ctx_px_y + int(extra_bottom))

                    # Optional inner margin (kept small; final crop uses ink bbox).
                    # On retries, reduce margin to avoid cutting stroke tails.
                    margin_scale = 1.0 if attempt == 0 else 0.0
                    mx = int(round(cell_w * float(args.cell_margin) * margin_scale))
                    my = int(round(cell_h * float(args.cell_margin) * margin_scale))
                    ctx_x0 = min(ctx_x1 - 1, ctx_x0 + mx)
                    ctx_x1 = max(ctx_x0 + 1, ctx_x1 - mx)
                    ctx_y0 = min(ctx_y1 - 1, ctx_y0 + my)
                    ctx_y1 = max(ctx_y0 + 1, ctx_y1 - my)

                    crop_ctx = img.crop((ctx_x0, ctx_y0, ctx_x1, ctx_y1))

                    exp_cx = ((box.x0 + box.x1) / 2.0) - float(ctx_x0)
                    exp_cy = ((box.y0 + box.y1) / 2.0) - float(ctx_y0)

                    bbox_pad_px = max(2, int(round(bbox_pad_base * pad_scale)))
                    crop_final, ink_bbox, quality = trim_glyph(
                        crop_ctx,
                        expected_center=(exp_cx, exp_cy),
                        ink_threshold=int(args.bbox_ink_threshold),
                        pad_px=bbox_pad_px,
                    )

                    # Evaluate clipping on the source page using a loose ink mask.
                    if ink_bbox is None:
                        trial_crop = [ctx_x0, ctx_y0, ctx_x1, ctx_y1]
                    else:
                        trial_crop = [
                            int(ctx_x0 + ink_bbox[0]),
                            int(ctx_y0 + ink_bbox[1]),
                            int(ctx_x0 + ink_bbox[2]),
                            int(ctx_y0 + ink_bbox[3]),
                        ]

                    contact = contact_ring_ink_directional(
                        page_ink_loose,
                        crop_box=trial_crop,
                        ring_px=8,
                        band_ratio=0.6,
                    )

                    # Accept if it's not empty and bbox isn't hugging the context edges.
                    if (
                        not bool(quality.get("is_empty"))
                        and contact.total <= int(contact_accept)
                        and int(quality.get("edge_touch", 0)) <= 2
                    ):
                        break

                    # Otherwise, update directional padding and retry.
                    if contact.top >= int(contact_dir_trigger):
                        extra_top += int(extra_step)
                    if contact.bottom >= int(contact_dir_trigger):
                        extra_bottom += int(extra_step)
                    if contact.left >= int(contact_dir_trigger):
                        extra_left += int(extra_step)
                    if contact.right >= int(contact_dir_trigger):
                        extra_right += int(extra_step)

                    extra_left = int(min(extra_left, max(0, int(box.x0) - int(cb.safe_x0))))
                    extra_right = int(min(extra_right, max(0, int(cb.safe_x1) - int(box.x1))))
                    extra_top = int(min(extra_top, max(0, int(box.y0) - int(rb.safe_y0))))
                    extra_bottom = int(
                        min(extra_bottom, max(0, int(rb.safe_y1) - int(box.y1)))
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

                # Final safety pass: expand crop box by contact signals.
                # Allow a small soft vertical bleed beyond the safe row corridor
                # to preserve cursive stroke tails (policy: prefer not clipped).
                # Keep this conservative; large bleed may cause overlap with
                # adjacent cells. QA will still surface overlap candidates.
                soft_bleed_y = int(min(40, max(12, round(float(cell_h) * 0.25))))
                soft_y0 = int(max(0, int(rb.safe_y0) - soft_bleed_y))
                soft_y1 = int(min(int(img.height), int(rb.safe_y1) + soft_bleed_y))
                page_crop_box = expand_crop_box_by_contact(
                    page_ink_loose,
                    crop_box=page_crop_box,
                    safe_x0=int(cb.safe_x0),
                    safe_x1=int(cb.safe_x1),
                    safe_y0=int(soft_y0),
                    safe_y1=int(soft_y1),
                    img_h=int(img.height),
                    ring_px=8,
                    accept=15,
                    trigger=12,
                    max_iter=16,
                )
                quality["crop_box"] = page_crop_box

                crop_final = img.crop(
                    (
                        int(page_crop_box[0]),
                        int(page_crop_box[1]),
                        int(page_crop_box[2]),
                        int(page_crop_box[3]),
                    )
                )

                if args.contrast and float(args.contrast) != 1.0:
                    crop_final = ImageEnhance.Contrast(crop_final).enhance(
                        float(args.contrast)
                    )

                exp_out_cx = ((box.x0 + box.x1) / 2.0) - float(page_crop_box[0])
                exp_out_cy = ((box.y0 + box.y1) / 2.0) - float(page_crop_box[1])

                out = render_square(
                    crop_final,
                    size=int(args.size),
                    inner_pad=int(args.inner_pad),
                    expected_center=(float(exp_out_cx), float(exp_out_cy)),
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
                            "safe_column_box": [
                                int(cb.safe_x0),
                                0,
                                int(cb.safe_x1),
                                int(img.height),
                            ],
                            "safe_row_box": [
                                int(cb.safe_x0),
                                int(rb.safe_y0),
                                int(cb.safe_x1),
                                int(rb.safe_y1),
                            ],
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


def contact_ring_ink(
    page_ink: np.ndarray,
    *,
    crop_box: list[int],
    ring_px: int,
) -> int:
    """Ink pixels in the outer ring that touch inner ink.

    This is a strong clipping signal: if ink right outside the crop is connected
    to ink inside the crop, the crop is likely cutting stroke tails.
    """

    x0, y0, x1, y1 = (int(crop_box[0]), int(crop_box[1]), int(crop_box[2]), int(crop_box[3]))
    h, w = page_ink.shape
    r = max(1, int(ring_px))

    ex0 = max(0, x0 - r)
    ey0 = max(0, y0 - r)
    ex1 = min(w, x1 + r)
    ey1 = min(h, y1 + r)
    if ex1 <= ex0 + 1 or ey1 <= ey0 + 1:
        return 0

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

    inner = np.zeros_like(ring, dtype=bool)
    inner_mask = page_ink[y0:y1, x0:x1]
    ih, iw = inner_mask.shape
    inner[iy0 : iy0 + ih, ix0 : ix0 + iw] = inner_mask

    ring[iy0:iy1, ix0:ix1] = False

    # 3x3 dilation
    padded = np.pad(inner, ((1, 1), (1, 1)), mode="constant", constant_values=False)
    dil = np.zeros_like(inner, dtype=bool)
    hh, ww = inner.shape
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            dil |= padded[1 + dy : 1 + dy + hh, 1 + dx : 1 + dx + ww]

    contact = ring & dil
    return int(contact.sum())


def contact_ring_ink_directional(
    page_ink: np.ndarray,
    *,
    crop_box: list[int],
    ring_px: int,
    band_ratio: float = 0.6,
) -> ContactInk:
    """Directional contact ink around a crop box.

    band_ratio limits side contact counting to the center band of the opposite axis
    to reduce false positives from neighbor noise.
    """

    x0, y0, x1, y1 = (int(crop_box[0]), int(crop_box[1]), int(crop_box[2]), int(crop_box[3]))
    h, w = page_ink.shape
    r = max(1, int(ring_px))

    ex0 = max(0, x0 - r)
    ey0 = max(0, y0 - r)
    ex1 = min(w, x1 + r)
    ey1 = min(h, y1 + r)
    if ex1 <= ex0 + 1 or ey1 <= ey0 + 1:
        return ContactInk(total=0, left=0, right=0, top=0, bottom=0)

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

    inner = np.zeros_like(ring, dtype=bool)
    inner_mask = page_ink[y0:y1, x0:x1]
    ih, iw = inner_mask.shape
    inner[iy0 : iy0 + ih, ix0 : ix0 + iw] = inner_mask

    ring[iy0:iy1, ix0:ix1] = False

    # 3x3 dilation
    padded = np.pad(inner, ((1, 1), (1, 1)), mode="constant", constant_values=False)
    dil = np.zeros_like(inner, dtype=bool)
    hh, ww = inner.shape
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            dil |= padded[1 + dy : 1 + dy + hh, 1 + dx : 1 + dx + ww]

    contact = ring & dil
    total = int(contact.sum())
    if total <= 0:
        return ContactInk(total=0, left=0, right=0, top=0, bottom=0)

    # Directional counts (with center-band filtering).
    band_ratio = float(max(0.2, min(1.0, band_ratio)))
    inner_w = max(1, int(ix1 - ix0))
    inner_h = max(1, int(iy1 - iy0))

    band_x0 = int(ix0 + (1.0 - band_ratio) * 0.5 * inner_w)
    band_x1 = int(ix1 - (1.0 - band_ratio) * 0.5 * inner_w)
    band_y0 = int(iy0 + (1.0 - band_ratio) * 0.5 * inner_h)
    band_y1 = int(iy1 - (1.0 - band_ratio) * 0.5 * inner_h)
    band_x0 = max(0, min(band_x0, contact.shape[1]))
    band_x1 = max(0, min(band_x1, contact.shape[1]))
    band_y0 = max(0, min(band_y0, contact.shape[0]))
    band_y1 = max(0, min(band_y1, contact.shape[0]))

    left = int(contact[band_y0:band_y1, :ix0].sum())
    right = int(contact[band_y0:band_y1, ix1:].sum())
    top = int(contact[:iy0, band_x0:band_x1].sum())
    bottom = int(contact[iy1:, band_x0:band_x1].sum())

    return ContactInk(total=total, left=left, right=right, top=top, bottom=bottom)


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


def compute_safe_column_bounds(
    cols_rtl: list[ColumnBox],
    detected_cols_rtl: list[ColumnBox],
    img_width: int,
) -> list[ColumnCropBounds]:
    """Compute per-column safe crop bounds.

    The returned bounds never shrink the detected/expanded column box; they only
    allow extra expansion into the gap between columns up to the midline.

    Columns are expected in right-to-left order.
    """

    if not cols_rtl:
        return []

    if len(detected_cols_rtl) != len(cols_rtl):
        # Fallback: use the expanded cols themselves.
        detected_cols_rtl = cols_rtl

    out: list[ColumnCropBounds] = []
    n = len(cols_rtl)
    for i, col in enumerate(cols_rtl):
        det = detected_cols_rtl[i]
        # Neighbor on the right (larger x)
        if i == 0:
            mid_right = int(img_width)
        else:
            right_nb_det = detected_cols_rtl[i - 1]
            mid_right = int(round((det.x1 + right_nb_det.x0) / 2.0))

        # Neighbor on the left (smaller x)
        if i == n - 1:
            mid_left = 0
        else:
            left_nb_det = detected_cols_rtl[i + 1]
            mid_left = int(round((left_nb_det.x1 + det.x0) / 2.0))

        safe_x0 = int(max(0, min(col.x0, mid_left)))
        safe_x1 = int(min(img_width, max(col.x1, mid_right)))
        if safe_x1 <= safe_x0 + 1:
            safe_x0 = int(max(0, col.x0))
            safe_x1 = int(min(img_width, col.x1))

        out.append(ColumnCropBounds(col=col, safe_x0=safe_x0, safe_x1=safe_x1))
    return out


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

    # IMPORTANT: Do not shrink y-range based on ink quantiles.
    # In some columns ink becomes sparse (seals/thresholding), and quantile-based
    # y_top/y_bottom may collapse the usable height, producing extremely small
    # cells (30-50px) and causing missing/clipped characters.
    y_top, y_bottom = 0, col_h

    height = max(1, y_bottom - y_top)
    step = height / float(expected_count)

    proj = ink_col[y_top:y_bottom, :].sum(axis=1).astype(np.float32)
    proj = _smooth_1d(proj, max(9, int(round(step * 0.18)) | 1))

    # Minimum cell height: keep it tied to the expected step to prevent
    # boundary drift accumulating into a tail collapse.
    min_cell = max(18, int(round(step * max(0.22, float(min_cell_ratio)))))

    # Find N-1 boundaries using a small DP over per-boundary candidate windows.
    # This avoids greedy "snap to deepest valley" behavior that can collapse
    # the first/last cells.
    search_win = max(14, int(round(step * 0.60)))
    proj_max = float(max(1.0, float(np.max(proj))))
    # Deviation penalty: keep boundary near its expected position.
    # Larger => more stable cell sizes; smaller => more valley-snapping.
    dev_lambda = 0.45
    # Transition penalty: keep per-cell heights close to step.
    # This reduces "first/last cell collapse" where a deep valley near the
    # column edge attracts the boundary too strongly.
    size_lambda = 0.85

    cand_y: list[list[int]] = []
    cand_cost: list[list[float]] = []
    for i in range(1, expected_count):
        remaining = expected_count - i
        y_expect = int(y_top + round(step * i))

        lo = int(max(y_top + min_cell, y_expect - search_win))
        hi = int(min(y_bottom - remaining * min_cell, y_expect + search_win))
        if hi <= lo + 2:
            lo = int(max(y_top + min_cell, y_expect - 2))
            hi = int(min(y_bottom - remaining * min_cell, y_expect + 2))
        if hi <= lo:
            # As a last resort, fall back to the expected position.
            lo = int(max(y_top + min_cell, min(y_expect, y_bottom - remaining * min_cell - 1)))
            hi = lo + 1

        ys = list(range(int(lo), int(hi)))
        costs: list[float] = []
        for y in ys:
            dev = (float(y) - float(y_expect)) / max(1.0, float(step))
            costs.append(float(proj[y]) / proj_max + dev_lambda * dev * dev)
        cand_y.append(ys)
        cand_cost.append(costs)

    # DP: dp[i][j] = min cost up to boundary i (0-based), choosing candidate j.
    # Transition allowed if spacing >= min_cell.
    INF = 1e18
    dp: list[list[float]] = []
    prev_idx: list[list[int]] = []
    for i in range(len(cand_y)):
        m = len(cand_y[i])
        dp.append([INF] * m)
        prev_idx.append([-1] * m)

    if cand_y:
        for j in range(len(cand_y[0])):
            y = cand_y[0][j]
            cell = (float(y) - float(y_top)) / max(1.0, float(step))
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
                prev_idx[i][j] = best_k

    # Backtrack.
    boundaries: list[int] = [int(y_top)]
    if not cand_y:
        boundaries.append(int(y_bottom))
    else:
        last_i = len(cand_y) - 1
        best_j = min(range(len(dp[last_i])), key=lambda j: dp[last_i][j])
        if dp[last_i][best_j] >= INF / 2:
            # Fallback: greedy with a deviation penalty.
            cur = int(y_top)
            for i in range(1, expected_count):
                remaining = expected_count - i
                y_expect = int(y_top + round(step * i))
                low = int(cur + min_cell)
                high = int(y_bottom - remaining * min_cell)
                if high <= low:
                    y = int(max(cur + 1, min(y_expect, y_bottom - 1)))
                    boundaries.append(y)
                    cur = y
                    continue
                a = max(low, y_expect - search_win)
                b = min(high, y_expect + search_win)
                best_y = int(max(low, min(y_expect, high)))
                best_cost = INF
                for y in range(a, b):
                    dev = (float(y) - float(y_expect)) / max(1.0, float(step))
                    c = float(proj[y]) / proj_max + dev_lambda * dev * dev
                    if c < best_cost:
                        best_cost = c
                        best_y = y
                boundaries.append(int(best_y))
                cur = int(best_y)
        else:
            chosen: list[int] = [0] * (len(cand_y))
            chosen[last_i] = best_j
            for i in range(last_i, 0, -1):
                chosen[i - 1] = prev_idx[i][chosen[i]]
            for i, j in enumerate(chosen):
                if j < 0:
                    # Shouldn't happen, but keep things monotonic.
                    boundaries.append(int(min(boundaries[-1] + min_cell, y_bottom - 1)))
                else:
                    boundaries.append(int(cand_y[i][j]))

        boundaries.append(int(y_bottom))

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
    strict_thr = int(ink_threshold)
    loose_thr = min(255, strict_thr + 35)

    ink_strict = ink_mask(arr, ink_threshold=strict_thr)
    ink_loose = ink_mask(arr, ink_threshold=loose_thr)
    h, w = ink_strict.shape

    # Reject huge solid blocks (occlusion) inside this context crop.
    m = ink_strict.astype(np.uint8)
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
        # Keep this conservative; overly aggressive dropping can erase real glyphs.
        if area_ratio >= 0.55 and fill >= 0.70 and per_area > 0 and per_area <= 0.045:
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

        # Prefer the dominant glyph component over small near-center noise.
        # Distance to expected_center is still useful, but weaker than size.
        score = 0.65 * dist - 0.62 * size_bonus + block_penalty + edge_penalty
        comps.append((score, i, x, y, ww, hh, cx, cy))

    if not comps:
        # Fallback: no strict components. Try a loose bbox (captures faint strokes).
        ys, xs = np.where(ink_loose)
        if xs.size >= max(12, int(region_area * 0.0008)):
            x0 = int(xs.min())
            x1 = int(xs.max() + 1)
            y0 = int(ys.min())
            y1 = int(ys.max() + 1)
            x0p = max(0, x0 - pad_px)
            y0p = max(0, y0 - pad_px)
            x1p = min(w, x1 + pad_px)
            y1p = min(h, y1 + pad_px)
            tol = 2
            edge_touch = (
                int(x0p <= tol)
                + int(y0p <= tol)
                + int(x1p >= w - 1 - tol)
                + int(y1p >= h - 1 - tol)
            )
            quality = {
                "ink_pixels": int(ink_loose.sum()),
                "cc": 0,
                "edge_touch": edge_touch,
                "is_empty": False,
                "crop_box": None,
            }
            trimmed = img.crop((int(x0p), int(y0p), int(x1p), int(y1p)))
            return trimmed, [int(x0p), int(y0p), int(x1p), int(y1p)], quality

        # Truly empty.
        quality = {
            "ink_pixels": int(ink_strict.sum()),
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

    # Expand bbox using loose mask within a neighborhood, to keep faint stroke tails.
    loose_expand = max(6, int(round(min(w, h) * 0.08)))
    lx0 = max(0, x0 - loose_expand)
    ly0 = max(0, y0 - loose_expand)
    lx1 = min(w, x1 + loose_expand)
    ly1 = min(h, y1 + loose_expand)
    ys, xs = np.where(ink_loose[ly0:ly1, lx0:lx1])
    if xs.size >= max(12, int(region_area * 0.0008)):
        x0 = min(x0, int(lx0 + xs.min()))
        x1 = max(x1, int(lx0 + xs.max() + 1))
        y0 = min(y0, int(ly0 + ys.min()))
        y1 = max(y1, int(ly0 + ys.max() + 1))

    # Pad and clamp.
    # Use a square crop centered on the ink bbox to improve centering.
    cx = (float(x0) + float(x1)) / 2.0
    cy = (float(y0) + float(y1)) / 2.0
    side = float(max(1, x1 - x0, y1 - y0) + 2 * pad_px)
    half = side / 2.0

    x0p = int(round(cx - half))
    y0p = int(round(cy - half))
    x1p = int(round(cx + half))
    y1p = int(round(cy + half))

    # Clamp to image bounds.
    if x0p < 0:
        x1p -= x0p
        x0p = 0
    if y0p < 0:
        y1p -= y0p
        y0p = 0
    if x1p > w:
        shift = x1p - w
        x0p -= shift
        x1p = w
    if y1p > h:
        shift = y1p - h
        y0p -= shift
        y1p = h
    x0p = int(max(0, x0p))
    y0p = int(max(0, y0p))
    x1p = int(min(w, x1p))
    y1p = int(min(h, y1p))
    if x1p <= x0p + 1 or y1p <= y0p + 1:
        x0p = max(0, x0 - pad_px)
        y0p = max(0, y0 - pad_px)
        x1p = min(w, x1 + pad_px)
        y1p = min(h, y1 + pad_px)

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
        "ink_pixels": int(ink_loose.sum()),
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


def render_square(
    img: Image.Image,
    size: int,
    inner_pad: int,
    *,
    expected_center: tuple[float, float] | None = None,
) -> Image.Image:
    bg = (10, 10, 12)
    canvas = Image.new("RGB", (size, size), bg)

    max_w = max(1, size - inner_pad * 2)
    max_h = max(1, size - inner_pad * 2)
    # 1) Resize the crop to a working size (within max box).
    scale = min(max_w / img.width, max_h / img.height)
    work_w = max(1, int(round(img.width * scale)))
    work_h = max(1, int(round(img.height * scale)))
    work = img.resize((work_w, work_h), Image.Resampling.LANCZOS)

    # 2) Find the main ink bbox, crop tightly around it, then re-scale and center.
    arr8 = np.array(work.convert("RGB"))
    strict_thr = 125
    ink = ink_mask(arr8, ink_threshold=int(strict_thr))
    if int(ink.sum()) < 80:
        strict_thr = 155
        ink = ink_mask(arr8, ink_threshold=int(strict_thr))
    loose_thr = min(255, int(strict_thr) + 35)
    loose_ink = ink_mask(arr8, ink_threshold=int(loose_thr))

    m = ink.astype(np.uint8)
    num, labels, stats, centroids = cv2.connectedComponentsWithStats(m, connectivity=8)
    x0 = 0
    y0 = 0
    x1 = work_w
    y1 = work_h
    if int(num) > 1:
        region_area = float(work_w * work_h)
        min_area = max(20, int(region_area * 0.0006))
        if expected_center is not None:
            exp_cx = float(expected_center[0]) * float(scale)
            exp_cy = float(expected_center[1]) * float(scale)
        else:
            exp_cx = float(work_w) / 2.0
            exp_cy = float(work_h) / 2.0
        comps: list[tuple[float, int, int, int, int, int, float, float]] = []
        for cid in range(1, int(num)):
            area = int(stats[cid, cv2.CC_STAT_AREA])
            if area < min_area:
                continue
            xx = int(stats[cid, cv2.CC_STAT_LEFT])
            yy = int(stats[cid, cv2.CC_STAT_TOP])
            ww = int(stats[cid, cv2.CC_STAT_WIDTH])
            hh = int(stats[cid, cv2.CC_STAT_HEIGHT])
            cx = float(centroids[cid][0])
            cy = float(centroids[cid][1])

            dx = abs(cx - exp_cx) / max(1.0, float(work_w))
            dy = abs(cy - exp_cy) / max(1.0, float(work_h))
            dist = dx + dy
            area_ratio = float(area) / max(1.0, region_area)
            size_bonus = min(1.0, area_ratio / 0.08)
            touch = int(xx <= 1) + int(yy <= 1) + int(xx + ww >= work_w - 2) + int(yy + hh >= work_h - 2)
            edge_penalty = 0.08 * float(touch)
            # Prefer the dominant ink component over near-center speckles.
            score = 0.65 * dist - 0.62 * size_bonus + edge_penalty
            comps.append((score, cid, xx, yy, ww, hh, cx, cy))

        if comps:
            comps.sort(key=lambda t: t[0])
            _, best_id, bx, by, bww, bhh, _, _ = comps[0]

            expand = max(8, int(round(min(work_w, work_h) * 0.10)))
            ex0 = max(0, int(bx - expand))
            ex1 = min(int(work_w), int(bx + bww + expand))
            ey0 = max(0, int(by - expand))
            ey1 = min(int(work_h), int(by + bhh + expand))

            sel = []
            for _, cid, xx, yy, ww, hh, cx, cy in comps:
                if ex0 <= cx <= ex1 and ey0 <= cy <= ey1:
                    sel.append((xx, yy, xx + ww, yy + hh))
            if sel:
                x0 = min(s[0] for s in sel)
                y0 = min(s[1] for s in sel)
                x1 = max(s[2] for s in sel)
                y1 = max(s[3] for s in sel)

                # Faint-tail protection: within the expanded neighborhood of the
                # main component, allow loose ink to grow the bbox slightly.
                sub = loose_ink[ey0:ey1, ex0:ex1]
                if int(sub.sum()) >= 60:
                    ys, xs = np.where(sub)
                    lx0 = int(ex0 + int(xs.min()))
                    lx1 = int(ex0 + int(xs.max()) + 1)
                    ly0 = int(ey0 + int(ys.min()))
                    ly1 = int(ey0 + int(ys.max()) + 1)
                    x0 = min(int(x0), lx0)
                    x1 = max(int(x1), lx1)
                    y0 = min(int(y0), ly0)
                    y1 = max(int(y1), ly1)

    pad = max(4, int(round(min(work_w, work_h) * 0.06)))
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(work_w, x1 + pad)
    y1 = min(work_h, y1 + pad)
    tight = work.crop((int(x0), int(y0), int(x1), int(y1)))

    # 3) Final resize to fit and paste centered.
    scale2 = min(max_w / tight.width, max_h / tight.height)
    final_w = max(1, int(round(tight.width * scale2)))
    final_h = max(1, int(round(tight.height * scale2)))
    final_img = tight.resize((final_w, final_h), Image.Resampling.LANCZOS)

    x = (size - final_w) // 2
    y = (size - final_h) // 2
    canvas.paste(final_img, (x, y))
    return canvas


if __name__ == "__main__":
    raise SystemExit(main())
