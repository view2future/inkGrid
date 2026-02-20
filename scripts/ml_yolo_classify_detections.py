#!/usr/bin/env python3

"""Run a YOLO classification model on detection crops.

This produces a `pred-json` file that can be consumed by `scripts/ml_align_sequence.py`
to improve full-text alignment.

Inputs:

- detections-seq: JSON from scripts/ml_build_detection_sequence.py
- stele-dir: directory containing the page images referenced by detections
- classes-json: JSON mapping class tags (e.g. U6C49) to char

Install dependency:

  python3 -m pip install -U ultralytics
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True, help="Ultralytics classify weights (.pt)")
    ap.add_argument("--detections-seq", required=True)
    ap.add_argument("--stele-dir", required=True)
    ap.add_argument("--classes-json", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--imgsz", type=int, default=224)
    ap.add_argument("--topk", type=int, default=5)
    ap.add_argument("--device", default="mps")
    args = ap.parse_args()

    try:
        from ultralytics import YOLO  # type: ignore
    except Exception as e:
        raise SystemExit(
            "Missing dependency: ultralytics. Install with `python3 -m pip install -U ultralytics`.\n"
            + f"Import error: {e}"
        )

    seq = json.loads(Path(args.detections_seq).read_text(encoding="utf-8"))
    dets = seq.get("detections")
    if not isinstance(dets, list):
        raise SystemExit("detections-seq must contain detections[]")

    classes = json.loads(Path(args.classes_json).read_text(encoding="utf-8"))
    mapping = classes.get("classes")
    if not isinstance(mapping, dict):
        raise SystemExit("classes-json must contain {classes:{UXXXX:char}}")

    stele_dir = Path(args.stele_dir).resolve()

    # Prepare crops in memory.
    crop_imgs: list[Image.Image] = []
    crop_ids: list[str] = []
    crop_meta: list[dict] = []

    page_cache: dict[str, Image.Image] = {}

    def load_page(name: str) -> Image.Image:
        if name not in page_cache:
            p = stele_dir / name
            if not p.exists():
                raise FileNotFoundError(f"Missing page image: {p}")
            page_cache[name] = Image.open(p).convert("RGB")
        return page_cache[name]

    for d in dets:
        if not isinstance(d, dict):
            continue
        det_id = str(d.get("id") or "").strip()
        if not det_id:
            continue
        flags = d.get("flags") or []
        if isinstance(flags, list) and ("ignored" in flags):
            continue
        page = str(d.get("page") or "").strip()
        bb = d.get("xyxy")
        if not page or not (isinstance(bb, list) and len(bb) == 4):
            continue
        img = load_page(page)
        x0, y0, x1, y1 = [int(bb[0]), int(bb[1]), int(bb[2]), int(bb[3])]
        x0 = max(0, min(x0, img.width - 1))
        y0 = max(0, min(y0, img.height - 1))
        x1 = max(x0 + 1, min(x1, img.width))
        y1 = max(y0 + 1, min(y1, img.height))
        crop = img.crop((x0, y0, x1, y1))
        crop_imgs.append(crop)
        crop_ids.append(det_id)
        crop_meta.append({"page": page, "xyxy": [x0, y0, x1, y1], "score": float(d.get("score") or 0.0)})

    if not crop_imgs:
        raise SystemExit("No crops to classify")

    model = YOLO(str(Path(args.model).resolve()))
    res = model.predict(
        source=crop_imgs,
        imgsz=int(args.imgsz),
        device=str(args.device),
        verbose=False,
    )

    preds: dict[str, list[dict]] = {}
    for det_id, r in zip(crop_ids, res):
        probs = getattr(r, "probs", None)
        names = getattr(r, "names", None) or {}
        if probs is None:
            continue

        # `top5` yields indices. Use `data` to get probabilities.
        topk = int(max(1, min(50, int(args.topk))))
        idxs = list(getattr(probs, "top5", []))[:topk]
        out: list[dict] = []
        for idx in idxs:
            try:
                idx_int = int(idx)
            except Exception:
                continue
            label = str(names.get(idx_int, ""))
            # Ultralytics classification labels are directory names.
            ch = str(mapping.get(label) or "").strip()
            try:
                p = float(probs.data[idx_int])  # type: ignore
            except Exception:
                p = 0.0
            if not ch or p <= 0:
                continue
            out.append({"char": ch, "tag": label, "p": p})
        if out:
            preds[det_id] = out

    out_path = Path(args.out).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out = {
        "model": str(args.model),
        "detections_seq": str(Path(args.detections_seq)),
        "classes_json": str(Path(args.classes_json)),
        "imgsz": int(args.imgsz),
        "topk": int(args.topk),
        "preds": preds,
    }
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"done preds={len(preds)} out={out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
