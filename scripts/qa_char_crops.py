#!/usr/bin/env python3
"""QA report for single-character crop datasets.

This script is intended to be re-used across steles datasets.

Inputs:
- dataset-dir: directory containing index.json and output PNGs
- source-dir: directory containing the source page images referenced by index.json

Outputs (written into dataset-dir by default):
- qa_report.json: per-file metrics and flags (strict by default)
- qa_summary.md: top suspicious samples for quick review

Design goals:
- Prefer "not clipped" over "not noisy": tolerate small neighbor-column noise
  but flag evidence that ink continues outside the crop box.
- Be strict: generate more candidates than miss issues.
"""

from __future__ import annotations

import argparse
import json
import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image


BG_RGB = (10, 10, 12)


OVERLAP_Y_THR = 0.35
NEAR_DUP_SIM_THR = 0.985


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dataset-dir",
        required=True,
        help="Directory containing index.json + character PNGs",
    )
    parser.add_argument(
        "--source-dir",
        required=True,
        help="Directory containing source page images",
    )
    parser.add_argument(
        "--out-report",
        default=None,
        help="Path to qa_report.json (defaults to dataset-dir/qa_report.json)",
    )
    parser.add_argument(
        "--out-summary",
        default=None,
        help="Path to qa_summary.md (defaults to dataset-dir/qa_summary.md)",
    )
    parser.add_argument(
        "--top",
        type=int,
        default=120,
        help="How many suspicious entries to list in qa_summary.md",
    )
    parser.add_argument(
        "--ring-px",
        type=int,
        default=8,
        help="Outer ring size (page pixels) for clipped detection",
    )
    parser.add_argument(
        "--strict-ink-thr",
        type=int,
        default=135,
        help="Ink threshold for strict mask",
    )
    parser.add_argument(
        "--loose-ink-thr",
        type=int,
        default=155,
        help="Ink threshold for loose mask",
    )
    parser.add_argument(
        "--center-thr",
        type=float,
        default=28.0,
        help="Absolute dx/dy threshold for off-center flag (output pixels)",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        default=True,
        help="Enable strict QA flags (default true)",
    )
    args = parser.parse_args()

    dataset_dir = Path(args.dataset_dir)
    source_dir = Path(args.source_dir)

    index_path = dataset_dir / "index.json"
    if not index_path.exists():
        raise SystemExit(f"Missing index.json: {index_path}")

    out_report = Path(args.out_report) if args.out_report else (dataset_dir / "qa_report.json")
    out_summary = Path(args.out_summary) if args.out_summary else (dataset_dir / "qa_summary.md")

    data = json.loads(index_path.read_text(encoding="utf-8"))
    files = data.get("files")
    if not isinstance(files, list):
        raise SystemExit("Invalid index.json: missing 'files' list")

    page_cache: dict[str, Image.Image] = {}

    def load_page(name: str) -> Image.Image:
        if name not in page_cache:
            p = source_dir / name
            if not p.exists():
                raise FileNotFoundError(f"Missing source image: {p}")
            page_cache[name] = Image.open(p).convert("RGB")
        return page_cache[name]

    report_entries: list[dict] = []

    regression_cases = load_regression_cases(source_dir)
    regression_set = set(regression_cases)

    for e in files:
        filename = e.get("file")
        ch = e.get("char")
        src = e.get("source") or {}
        page_name = src.get("image")
        crop_box = src.get("crop_box")
        if not filename or not page_name or not crop_box:
            continue

        png_path = dataset_dir / filename
        if not png_path.exists():
            # Still record missing output.
            report_entries.append(
                {
                    "index": e.get("index"),
                    "char": ch,
                    "file": filename,
                    "flags": ["missing_output"],
                    "score": 1000.0,
                }
            )
            continue

        page = load_page(page_name)
        crop = page.crop(
            (
                int(crop_box[0]),
                int(crop_box[1]),
                int(crop_box[2]),
                int(crop_box[3]),
            )
        )
        crop_arr = np.array(crop)

        strict_mask = ink_mask(crop_arr, ink_threshold=int(args.strict_ink_thr))
        loose_mask = ink_mask(crop_arr, ink_threshold=int(args.loose_ink_thr))

        edge_touch_strict = edge_touch(strict_mask, margin=2)
        edge_touch_loose = edge_touch(loose_mask, margin=2)

        # Outer ring ink: evidence of cropping too tight.
        ring = compute_outer_ring_ink(
            page,
            crop_box=(
                int(crop_box[0]),
                int(crop_box[1]),
                int(crop_box[2]),
                int(crop_box[3]),
            ),
            ring_px=int(args.ring_px),
            ink_threshold=int(args.loose_ink_thr),
        )

        center = compute_center_offset(png_path)
        flags: list[str] = []

        if ring.contact_ink_pixels >= 40:
            flags.append("clipped_outer_ring")
        # Many glyphs naturally touch crop edges after normalization.
        # Only flag edge-touch when we also see some outside-ink evidence.
        if edge_touch_loose >= 3 and (
            ring.contact_ink_pixels >= 20 or ring.ring_ink_pixels >= 500
        ):
            flags.append("touching_edges")
        if center and (
            abs(center.dx) >= float(args.center_thr)
            or abs(center.dy) >= float(args.center_thr)
        ):
            flags.append("off_center")

        side_thr = 25
        if ring.contact_left >= side_thr:
            flags.append("clipped_left")
        if ring.contact_right >= side_thr:
            flags.append("clipped_right")
        if ring.contact_top >= side_thr:
            flags.append("clipped_top")
        if ring.contact_bottom >= side_thr:
            flags.append("clipped_bottom")

        suggestions: list[str] = []
        if ring.contact_left >= side_thr:
            suggestions.append("expand_left")
        if ring.contact_right >= side_thr:
            suggestions.append("expand_right")
        if ring.contact_top >= side_thr:
            suggestions.append("expand_top")
        if ring.contact_bottom >= side_thr:
            suggestions.append("expand_bottom")
        if "off_center" in flags:
            suggestions.append("recenter")

        if filename in regression_set:
            flags.append("regression_case")

        # Score: strict mode biases towards surfacing clipped candidates.
        score = 0.0
        score += 14.0 * float(ring.contact_ink_pixels > 0)
        score += 0.7 * float(edge_touch_loose)
        score += 0.010 * float(ring.contact_ink_pixels)
        if center:
            score += 0.15 * (abs(center.dx) + abs(center.dy))
        if filename in regression_set:
            score += 18.0

        report_entries.append(
            {
                "index": e.get("index"),
                "char": ch,
                "file": filename,
                "source": {
                    "image": page_name,
                    "crop_box": crop_box,
                    "safe_column_box": src.get("safe_column_box"),
                    "safe_row_box": src.get("safe_row_box"),
                    "line_index": src.get("line_index"),
                    "pos_in_line": src.get("pos_in_line"),
                },
                "metrics": {
                    "crop_wh": [int(crop.width), int(crop.height)],
                    "strict_ink": int(strict_mask.sum()),
                    "loose_ink": int(loose_mask.sum()),
                    "edge_touch_strict": int(edge_touch_strict),
                    "edge_touch_loose": int(edge_touch_loose),
                    "outer_ring_px": int(args.ring_px),
                    "outer_ring_ink": int(ring.ring_ink_pixels),
                    "outer_ring_ink_ratio": float(ring.ring_ink_ratio),
                    "outer_ring_contact_ink": int(ring.contact_ink_pixels),
                    "outer_ring_contact_ratio": float(ring.contact_ink_ratio),
                    "outer_ring_contact_left": int(ring.contact_left),
                    "outer_ring_contact_right": int(ring.contact_right),
                    "outer_ring_contact_top": int(ring.contact_top),
                    "outer_ring_contact_bottom": int(ring.contact_bottom),
                    "center_dx": float(center.dx) if center else None,
                    "center_dy": float(center.dy) if center else None,
                },
                "flags": flags,
                "suggestions": suggestions,
                "score": float(score),
            }
        )

    # Post-pass: cross-cell overlap detection and near-duplicate mismatch.
    overlap_pairs = add_overlap_adjacent_cell_flags(report_entries, thr=OVERLAP_Y_THR)
    dup_pairs = add_near_duplicate_mismatch_flags(
        report_entries, dataset_dir=dataset_dir, sim_thr=NEAR_DUP_SIM_THR
    )

    # Re-sort after adding flags/score bumps.
    report_entries.sort(key=lambda x: float(x.get("score", 0.0)), reverse=True)

    out_report.write_text(
        json.dumps(
            {
                "dataset_dir": str(dataset_dir),
                "source_dir": str(source_dir),
                "params": {
                    "ring_px": int(args.ring_px),
                    "strict_ink_thr": int(args.strict_ink_thr),
                    "loose_ink_thr": int(args.loose_ink_thr),
                    "center_thr": float(args.center_thr),
                    "strict": bool(args.strict),
                },
                "totals": {
                    "files": len(report_entries),
                    "flagged": sum(1 for r in report_entries if r.get("flags")),
                    "regression_cases": len(regression_cases),
                    "overlap_pairs": len(overlap_pairs),
                    "near_duplicate_pairs": len(dup_pairs),
                },
                "entries": report_entries,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    out_summary.write_text(
        build_summary_md(
            report_entries,
            top=int(args.top),
            dataset_dir=dataset_dir,
            out_report=out_report,
            regression_cases=regression_cases,
            overlap_pairs=overlap_pairs,
            near_duplicate_pairs=dup_pairs,
        ),
        encoding="utf-8",
    )

    print(f"Wrote QA report: {out_report}")
    print(f"Wrote QA summary: {out_summary}")
    return 0


def load_regression_cases(source_dir: Path) -> list[str]:
    # Convention: regression_cases.json lives next to the source images.
    p = source_dir / "regression_cases.json"
    if not p.exists():
        return []
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return []

    cases = data.get("cases")
    if not isinstance(cases, list):
        return []

    out: list[str] = []
    for block in cases:
        files = block.get("files") if isinstance(block, dict) else None
        if not isinstance(files, list):
            continue
        for f in files:
            if isinstance(f, str):
                out.append(f)
    return out


def build_summary_md(
    entries: list[dict],
    *,
    top: int,
    dataset_dir: Path,
    out_report: Path,
    regression_cases: list[str],
    overlap_pairs: list[dict],
    near_duplicate_pairs: list[dict],
) -> str:
    lines: list[str] = []
    lines.append("# QA Summary\n")
    lines.append(f"Report: `{out_report}`\n")
    lines.append(f"Dataset: `{dataset_dir}`\n")
    if regression_cases:
        lines.append(f"Regression cases: {len(regression_cases)}\n")

    lines.append("## Top Suspicious\n")
    lines.append("(Strict mode: prefer not-clipped; allow some neighbor noise.)\n")

    shown = entries[: max(0, int(top))]
    for r in shown:
        idx = r.get("index")
        ch = r.get("char")
        fn = r.get("file")
        score = float(r.get("score", 0.0))
        flags = r.get("flags") or []
        m = r.get("metrics") or {}
        ring = m.get("outer_ring_ink")
        et = m.get("edge_touch_loose")
        dx = m.get("center_dx")
        dy = m.get("center_dy")
        lines.append(
            f"- {idx:04d} {ch} `{fn}` score={score:.2f} flags={flags} ring={ring} edge={et} center=({fmt(dx)},{fmt(dy)})"
        )

    lines.append("\n## How To Use\n")
    lines.append(
        "- Open the PNGs listed above and verify: missing/clipped/off-center.\n"
    )
    lines.append(
        "- For clipped candidates, prioritize expanding crop within safe column corridor (up to midline).\n"
    )

    if overlap_pairs:
        lines.append("\n## Cross-Cell Overlap (Top)\n")
        lines.append(
            "(Heuristic: adjacent cells in the same column overlap too much in Y; likely cross-cell swallow.)\n"
        )
        for p in overlap_pairs[:40]:
            lines.append(
                f"- overlap={p.get('overlap'):.2f} page={p.get('page')} col={p.get('line_index')} "
                f"{p.get('a_index'):04d}{p.get('a_char')} `{p.get('a_file')}` <-> "
                f"{p.get('b_index'):04d}{p.get('b_char')} `{p.get('b_file')}`"
            )

    if near_duplicate_pairs:
        lines.append("\n## Near-Duplicate Mismatch (Top)\n")
        lines.append(
            "(Heuristic: output PNGs are extremely similar but labels differ; likely mislabel or swallow.)\n"
        )
        for p in near_duplicate_pairs[:40]:
            lines.append(
                f"- sim={p.get('sim'):.4f} {p.get('a_index'):04d}{p.get('a_char')} `{p.get('a_file')}` ~ "
                f"{p.get('b_index'):04d}{p.get('b_char')} `{p.get('b_file')}`"
            )
    return "\n".join(lines) + "\n"


def y_overlap_ratio(a: list[int], b: list[int]) -> float:
    ay0, ay1 = int(a[1]), int(a[3])
    by0, by1 = int(b[1]), int(b[3])
    inter = max(0, min(ay1, by1) - max(ay0, by0))
    if inter <= 0:
        return 0.0
    da = max(1, ay1 - ay0)
    db = max(1, by1 - by0)
    return float(inter) / float(min(da, db))


def add_overlap_adjacent_cell_flags(entries: list[dict], *, thr: float) -> list[dict]:
    by_col: dict[tuple[str, int], list[dict]] = {}
    by_file: dict[str, dict] = {}
    for r in entries:
        fn = str(r.get("file") or "")
        if fn:
            by_file[fn] = r

        src = r.get("source") or {}
        page = src.get("image")
        line_index = src.get("line_index")
        pos = src.get("pos_in_line")
        crop = src.get("crop_box")
        if not page or line_index is None or pos is None or not crop:
            continue
        key = (str(page), int(line_index))
        by_col.setdefault(key, []).append(r)

    pairs: list[dict] = []
    for (page, line_index), lst in by_col.items():
        lst_sorted = sorted(lst, key=lambda x: int((x.get("source") or {}).get("pos_in_line") or 0))
        for a, b in zip(lst_sorted, lst_sorted[1:]):
            sa = a.get("source") or {}
            sb = b.get("source") or {}
            ca = sa.get("crop_box")
            cb = sb.get("crop_box")
            if not ca or not cb:
                continue
            ov = y_overlap_ratio(ca, cb)
            if ov < float(thr):
                continue

            for r in (a, b):
                flags = list(r.get("flags") or [])
                if "overlap_adjacent_cells" not in flags:
                    flags.append("overlap_adjacent_cells")
                r["flags"] = flags
                sug = list(r.get("suggestions") or [])
                if "retrim_with_safe_row" not in sug:
                    sug.append("retrim_with_safe_row")
                r["suggestions"] = sug
                r["score"] = float(r.get("score", 0.0)) + 12.0

            pairs.append(
                {
                    "overlap": float(ov),
                    "page": page,
                    "line_index": int(line_index),
                    "a_index": int(a.get("index") or 0),
                    "a_char": a.get("char"),
                    "a_file": a.get("file"),
                    "b_index": int(b.get("index") or 0),
                    "b_char": b.get("char"),
                    "b_file": b.get("file"),
                }
            )

    pairs.sort(key=lambda x: float(x.get("overlap", 0.0)), reverse=True)
    return pairs


def _feat_32x32(png_path: Path) -> np.ndarray:
    resampling = getattr(Image, "Resampling", None)
    resample = getattr(resampling, "BILINEAR", 2)
    img = Image.open(png_path).convert("L").resize((32, 32), resample)
    a = np.asarray(img, dtype=np.float32) / 255.0
    a = 1.0 - a
    a = a - float(a.mean())
    n = float(np.linalg.norm(a))
    if n > 1e-6:
        a = a / n
    return a.reshape(-1)


def add_near_duplicate_mismatch_flags(
    entries: list[dict], *, dataset_dir: Path, sim_thr: float
) -> list[dict]:
    # Small dataset; O(n^2) is acceptable.
    items: list[tuple[str, Path, dict]] = []
    for r in entries:
        fn = str(r.get("file") or "")
        if not fn:
            continue
        p = dataset_dir / fn
        if not p.exists():
            continue
        items.append((fn, p, r))

    if len(items) < 3:
        return []

    feats = []
    for _, p, _ in items:
        feats.append(_feat_32x32(p))
    F = np.stack(feats, axis=0)
    sim = F @ F.T
    np.fill_diagonal(sim, -1.0)

    pairs: list[dict] = []
    seen: set[tuple[str, str]] = set()

    for i in range(sim.shape[0]):
        j = int(sim[i].argmax())
        s = float(sim[i, j])
        if s < float(sim_thr):
            continue

        a_fn, _, a_r = items[i]
        b_fn, _, b_r = items[j]
        a_char = str(a_r.get("char") or "")
        b_char = str(b_r.get("char") or "")
        if not a_char or not b_char or a_char == b_char:
            continue

        s0, s1 = sorted([a_fn, b_fn])
        key = (s0, s1)
        if key in seen:
            continue
        seen.add(key)

        for r in (a_r, b_r):
            flags = list(r.get("flags") or [])
            if "near_duplicate_mismatch" not in flags:
                flags.append("near_duplicate_mismatch")
            r["flags"] = flags
            sug = list(r.get("suggestions") or [])
            if "check_duplicate" not in sug:
                sug.append("check_duplicate")
            r["suggestions"] = sug
            r["score"] = float(r.get("score", 0.0)) + 10.0

        pairs.append(
            {
                "sim": float(s),
                "a_index": int(a_r.get("index") or 0),
                "a_char": a_r.get("char"),
                "a_file": a_fn,
                "b_index": int(b_r.get("index") or 0),
                "b_char": b_r.get("char"),
                "b_file": b_fn,
            }
        )

    pairs.sort(key=lambda x: float(x.get("sim", 0.0)), reverse=True)
    return pairs


def fmt(v) -> str:
    if v is None:
        return "-"
    try:
        return f"{float(v):.1f}"
    except Exception:
        return "-"


def edge_touch(mask: np.ndarray, margin: int) -> int:
    h, w = mask.shape
    m = int(margin)
    if h <= 0 or w <= 0:
        return 0
    return (
        int(mask[:, :m].any())
        + int(mask[:m, :].any())
        + int(mask[:, w - m :].any())
        + int(mask[h - m :, :].any())
    )


def ink_mask(arr: np.ndarray, *, ink_threshold: int) -> np.ndarray:
    r = arr[..., 0].astype(np.int16)
    g = arr[..., 1].astype(np.int16)
    b = arr[..., 2].astype(np.int16)
    gray = (0.299 * r + 0.587 * g + 0.114 * b).astype(np.float32)

    # Heuristic: seals are red-ish and not too dark.
    redish = (r > 120) & ((r - g) > 40) & ((r - b) > 40)
    seal = redish & (gray > 82)

    ink = gray < float(int(ink_threshold))
    return ink & (~seal)


@dataclass(frozen=True)
class OuterRingInk:
    ring_ink_pixels: int
    ring_ink_ratio: float
    contact_ink_pixels: int
    contact_ink_ratio: float
    contact_left: int
    contact_right: int
    contact_top: int
    contact_bottom: int


def compute_outer_ring_ink(
    page: Image.Image,
    *,
    crop_box: tuple[int, int, int, int],
    ring_px: int,
    ink_threshold: int,
) -> OuterRingInk:
    x0, y0, x1, y1 = crop_box
    w, h = page.size
    r = int(max(1, ring_px))

    ex0 = max(0, x0 - r)
    ey0 = max(0, y0 - r)
    ex1 = min(w, x1 + r)
    ey1 = min(h, y1 + r)
    if ex1 <= ex0 + 1 or ey1 <= ey0 + 1:
        return OuterRingInk(
            ring_ink_pixels=0,
            ring_ink_ratio=0.0,
            contact_ink_pixels=0,
            contact_ink_ratio=0.0,
            contact_left=0,
            contact_right=0,
            contact_top=0,
            contact_bottom=0,
        )

    outer = page.crop((ex0, ey0, ex1, ey1))
    arr = np.array(outer)
    mask = ink_mask(arr, ink_threshold=int(ink_threshold))

    # Remove the inner region.
    ix0 = x0 - ex0
    iy0 = y0 - ey0
    ix1 = x1 - ex0
    iy1 = y1 - ey0
    ix0 = max(0, min(ix0, mask.shape[1]))
    ix1 = max(0, min(ix1, mask.shape[1]))
    iy0 = max(0, min(iy0, mask.shape[0]))
    iy1 = max(0, min(iy1, mask.shape[0]))

    ring = mask.copy()
    ring[iy0:iy1, ix0:ix1] = False
    pixels = int(ring.sum())
    denom = int(ring.size)

    # Contact ink: ring ink that touches the inner ink region. This is a stronger
    # clipping signal than "any ring ink" because it reduces false positives
    # from neighbor-column noise.
    inner = np.zeros_like(mask, dtype=bool)
    inner_mask = ink_mask(np.array(page.crop((x0, y0, x1, y1))), ink_threshold=int(ink_threshold))
    ih, iw = inner_mask.shape
    inner[iy0 : iy0 + ih, ix0 : ix0 + iw] = inner_mask
    inner_d = dilate_3x3(inner)
    contact = ring & inner_d
    contact_px = int(contact.sum())

    # Directional contact counts (helps with actionable suggestions).
    ch, cw = contact.shape
    # Inner box coordinates in the outer crop's coordinate system.
    ix0 = int(ix0)
    ix1 = int(ix1)
    iy0 = int(iy0)
    iy1 = int(iy1)

    # Center-band filtering (reduces false positives from neighbor noise).
    inner_w = max(1, int(ix1 - ix0))
    inner_h = max(1, int(iy1 - iy0))
    band_ratio = 0.6
    band_x0 = int(ix0 + (1.0 - band_ratio) * 0.5 * inner_w)
    band_x1 = int(ix1 - (1.0 - band_ratio) * 0.5 * inner_w)
    band_y0 = int(iy0 + (1.0 - band_ratio) * 0.5 * inner_h)
    band_y1 = int(iy1 - (1.0 - band_ratio) * 0.5 * inner_h)
    band_x0 = max(0, min(band_x0, cw))
    band_x1 = max(0, min(band_x1, cw))
    band_y0 = max(0, min(band_y0, ch))
    band_y1 = max(0, min(band_y1, ch))

    contact_left = int(contact[band_y0:band_y1, : max(0, ix0)].sum())
    contact_right = int(contact[band_y0:band_y1, min(cw, ix1) :].sum())
    contact_top = int(contact[: max(0, iy0), band_x0:band_x1].sum())
    contact_bottom = int(contact[min(ch, iy1) :, band_x0:band_x1].sum())

    return OuterRingInk(
        ring_ink_pixels=pixels,
        ring_ink_ratio=float(pixels / max(1, denom)),
        contact_ink_pixels=contact_px,
        contact_ink_ratio=float(contact_px / max(1, denom)),
        contact_left=contact_left,
        contact_right=contact_right,
        contact_top=contact_top,
        contact_bottom=contact_bottom,
    )


def dilate_3x3(mask: np.ndarray) -> np.ndarray:
    # Binary dilation with 3x3 kernel, no wrap-around.
    h, w = mask.shape
    if h == 0 or w == 0:
        return mask
    padded = np.pad(mask, ((1, 1), (1, 1)), mode="constant", constant_values=False)
    out = np.zeros_like(mask, dtype=bool)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            out |= padded[1 + dy : 1 + dy + h, 1 + dx : 1 + dx + w]
    return out


@dataclass(frozen=True)
class CenterOffset:
    dx: float
    dy: float


def compute_center_offset(png_path: Path) -> CenterOffset | None:
    try:
        img = Image.open(png_path).convert("RGB")
    except Exception:
        return None

    arr = np.array(img).astype(np.int16)
    bg = np.array(BG_RGB, dtype=np.int16)
    diff = np.max(np.abs(arr - bg[None, None, :]), axis=2)
    nonbg = diff > 8
    if int(nonbg.sum()) < 80:
        return None

    ys, xs = np.where(nonbg)
    x0, x1 = int(xs.min()), int(xs.max() + 1)
    y0, y1 = int(ys.min()), int(ys.max() + 1)
    patch = arr[y0:y1, x0:x1]

    # adaptive-ish ink threshold inside the patch
    r = patch[..., 0].astype(np.int16)
    g = patch[..., 1].astype(np.int16)
    b = patch[..., 2].astype(np.int16)
    gray = (0.299 * r + 0.587 * g + 0.114 * b).astype(np.float32)
    p = float(np.percentile(gray.reshape(-1), 12.0))
    thr = max(70.0, min(160.0, p + 18.0))
    ink = gray < thr

    # exclude background-like pixels inside patch
    diff2 = np.max(np.abs(patch - bg[None, None, :]), axis=2)
    ink = ink & (diff2 > 8)
    if int(ink.sum()) < 80:
        return None

    ys2, xs2 = np.where(ink)
    cx = float(x0) + float(xs2.mean())
    cy = float(y0) + float(ys2.mean())
    dx = cx - (arr.shape[1] / 2.0)
    dy = cy - (arr.shape[0] / 2.0)
    if not math.isfinite(dx) or not math.isfinite(dy):
        return None
    return CenterOffset(dx=float(dx), dy=float(dy))


if __name__ == "__main__":
    raise SystemExit(main())
