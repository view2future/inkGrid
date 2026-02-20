#!/usr/bin/env python3

"""Build an InkGrid char dataset from aligned detections (supports split).

Inputs:

- detections-seq: output from scripts/ml_build_detection_sequence.py
- alignment-json: output from scripts/ml_align_sequence.py
- stele-dir: contains the page images referenced by detections

For each aligned item:

- take=1 -> crop one image
- take=2 -> split bbox into two crops using ink projection valley

Outputs:

- out-dir/index.json
- per-char images (.webp default)
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


def clamp_box(box: list[int], *, w: int, h: int) -> list[int]:
    x0, y0, x1, y1 = [int(box[0]), int(box[1]), int(box[2]), int(box[3])]
    x0 = max(0, min(x0, w - 1))
    x1 = max(x0 + 1, min(x1, w))
    y0 = max(0, min(y0, h - 1))
    y1 = max(y0 + 1, min(y1, h))
    return [x0, y0, x1, y1]


def cp_tag(ch: str) -> str:
    if not ch:
        return "U003F"
    cp = ord(ch)
    if cp <= 0xFFFF:
        return f"U{cp:04X}"
    return f"U{cp:06X}"


def pick_split(mask: Any, *, axis: str) -> int | None:
    assert np is not None
    if mask.size <= 0:
        return None
    if axis == "y":
        proj = mask.sum(axis=1).astype("float32")
    else:
        proj = mask.sum(axis=0).astype("float32")
    n = int(proj.shape[0])
    if n < 20:
        return None
    mid = n // 2
    win = max(6, int(round(n * 0.18)))
    lo = max(2, mid - win)
    hi = min(n - 2, mid + win)
    if hi <= lo:
        return None
    best_i = min(range(lo, hi), key=lambda i: float(proj[i]))
    return int(best_i)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--stele-dir", required=True)
    ap.add_argument("--stele-slug", required=True)
    ap.add_argument("--detections-seq", required=True)
    ap.add_argument("--alignment-json", required=True)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--direction", required=True, choices=["vertical_rtl", "horizontal_ltr"])
    ap.add_argument("--size", type=int, default=512)
    ap.add_argument("--inner-pad", type=int, default=30)
    ap.add_argument("--format", choices=["png", "webp"], default="webp")
    ap.add_argument("--quality", type=int, default=82)
    ap.add_argument("--split-min-gap", type=int, default=8)
    ap.add_argument("--split-min-ink", type=int, default=10)
    args = ap.parse_args()

    stele_dir = Path(args.stele_dir).resolve()
    seq = json.loads(Path(args.detections_seq).read_text(encoding="utf-8"))
    dets = seq.get("detections")
    if not isinstance(dets, list):
        raise SystemExit("detections-seq must contain detections[]")
    det_by_id = {str(d.get("id")): d for d in dets if isinstance(d, dict) and d.get("id")}

    ali = json.loads(Path(args.alignment_json).read_text(encoding="utf-8"))
    aligned = ali.get("aligned")
    if not isinstance(aligned, list):
        raise SystemExit("alignment-json missing aligned[]")

    repo_root = Path(__file__).resolve().parent.parent
    mod = _load_extractor(repo_root)
    ink_mask = getattr(mod, "ink_mask")
    render_square = getattr(mod, "render_square")

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "overlays").mkdir(parents=True, exist_ok=True)

    page_cache: dict[str, tuple[Image.Image, Any]] = {}

    def load_page(name: str):
        if name not in page_cache:
            p = stele_dir / name
            if not p.exists():
                raise FileNotFoundError(f"Missing page: {p}")
            img = Image.open(p).convert("RGB")
            arr = np.asarray(img) if np is not None else None
            mask = ink_mask(arr, ink_threshold=150) if arr is not None else None
            page_cache[name] = (img, mask)
        return page_cache[name]

    entries: list[dict] = []
    out_idx = 0

    for a in aligned:
        if not isinstance(a, dict):
            continue
        det_id = str(a.get("id") or "")
        take = int(a.get("take") or 1)
        text = str(a.get("text") or "")
        det = det_by_id.get(det_id)
        if not det:
            continue
        flags = det.get("flags") or []
        if isinstance(flags, list) and ("ignored" in flags):
            continue
        page = str(det.get("page") or "")
        if not page:
            continue
        page_index = int(det.get("page_index") or 0)
        img, mask = load_page(page)
        w, h = img.size
        bb = det.get("xyxy")
        if not (isinstance(bb, list) and len(bb) == 4):
            continue
        box = clamp_box([int(bb[0]), int(bb[1]), int(bb[2]), int(bb[3])], w=w, h=h)

        def emit(one_box: list[int], ch: str, *, suffix: str | None = None):
            nonlocal out_idx
            out_idx += 1
            code = cp_tag(ch)
            ext = str(args.format)
            base = f"{args.stele_slug}_i{out_idx:04d}_p{page_index:02d}_{code}"
            if suffix:
                base += f"_{suffix}"
            filename = f"{base}.{ext}"
            crop = img.crop((one_box[0], one_box[1], one_box[2], one_box[3]))
            out = render_square(
                crop,
                size=int(args.size),
                inner_pad=int(args.inner_pad),
                expected_center=(float((one_box[2] - one_box[0]) / 2.0), float((one_box[3] - one_box[1]) / 2.0)),
            )
            out_path = out_dir / filename
            if ext == "webp":
                out.save(out_path, format="WEBP", quality=int(args.quality), method=6)
            else:
                out.save(out_path, format="PNG", optimize=True)
            entries.append(
                {
                    "index": out_idx,
                    "char": ch,
                    "char_trad": ch,
                    "char_simp": ch,
                    "codepoint": code.replace("U", "U+"),
                    "file": filename,
                    "source": {
                        "image": page,
                        "image_index": page_index,
                        "det_id": det_id,
                        "det_xyxy": box,
                        "crop_box": one_box,
                        "take": take,
                        "text_index": int(a.get("text_index") or 0),
                    },
                }
            )

        if take <= 1 or len(text) <= 1:
            emit(box, text[:1] or "?")
            continue

        # split into two
        axis = "y" if args.direction == "vertical_rtl" else "x"
        if mask is None:
            # fallback: geometric split
            if axis == "y":
                mid = (box[1] + box[3]) // 2
                emit([box[0], box[1], box[2], mid], text[0], suffix="a")
                emit([box[0], mid, box[2], box[3]], text[1], suffix="b")
            else:
                mid = (box[0] + box[2]) // 2
                emit([box[0], box[1], mid, box[3]], text[0], suffix="a")
                emit([mid, box[1], box[2], box[3]], text[1], suffix="b")
            continue

        x0, y0, x1, y1 = box
        sub = mask[y0:y1, x0:x1]
        if int(sub.sum()) < int(args.split_min_ink):
            # too empty, just split geometrically
            if axis == "y":
                mid = (y0 + y1) // 2
                emit([x0, y0, x1, mid], text[0], suffix="a")
                emit([x0, mid, x1, y1], text[1], suffix="b")
            else:
                mid = (x0 + x1) // 2
                emit([x0, y0, mid, y1], text[0], suffix="a")
                emit([mid, y0, x1, y1], text[1], suffix="b")
            continue

        cut = pick_split(sub, axis=axis)
        if cut is None:
            cut = (sub.shape[0] // 2) if axis == "y" else (sub.shape[1] // 2)

        gap = int(args.split_min_gap)
        if axis == "y":
            cut_y = int(y0 + cut)
            cut_y = max(y0 + gap, min(cut_y, y1 - gap))
            emit([x0, y0, x1, cut_y], text[0], suffix="a")
            emit([x0, cut_y, x1, y1], text[1], suffix="b")
        else:
            cut_x = int(x0 + cut)
            cut_x = max(x0 + gap, min(cut_x, x1 - gap))
            emit([x0, y0, cut_x, y1], text[0], suffix="a")
            emit([cut_x, y0, x1, y1], text[1], suffix="b")

    index = {
        "total_chars": len(entries),
        "meta": {
            "stele_slug": str(args.stele_slug),
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "direction": str(args.direction),
            "source": {"detections_seq": str(Path(args.detections_seq)), "alignment": str(Path(args.alignment_json))},
            "output": {"format": str(args.format), "quality": int(args.quality) if str(args.format) == "webp" else None, "size": int(args.size)},
        },
        "files": entries,
    }
    (out_dir / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"done chars={len(entries)} out={out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
