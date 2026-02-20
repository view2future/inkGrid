#!/usr/bin/env python3

"""Run an Ultralytics YOLO detector on stele page images.

This is a thin wrapper around `ultralytics.YOLO(...).predict(...)` that outputs a
stable JSON format consumed by `scripts/ml_refine_crops_with_detector.py`.

Install dependency (local venv):

  python3 -m pip install -U ultralytics

Example:

  python3 scripts/ml_yolo_predict_pages.py \
    --model runs/detect/train/weights/best.pt \
    --pages-dir steles/3-kaishu/4-qianhouchibifu \
    --glob 'qianhouchibifu-*.webp' \
    --out ml/exports/chibi_dets.json \
    --conf 0.15
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True, help="YOLO weights (pt)")
    ap.add_argument("--pages-dir", required=True)
    ap.add_argument("--glob", default="*.{jpg,jpeg,png,webp}")
    ap.add_argument("--out", required=True)
    ap.add_argument("--imgsz", type=int, default=1280)
    ap.add_argument("--conf", type=float, default=0.15)
    ap.add_argument("--device", default="mps")
    args = ap.parse_args()

    try:
        from ultralytics import YOLO  # type: ignore
    except Exception as e:
        raise SystemExit(
            "Missing dependency: ultralytics. Install with `python3 -m pip install -U ultralytics`.\n"
            + f"Import error: {e}"
        )

    pages_dir = Path(args.pages_dir).resolve()
    if not pages_dir.exists():
        raise SystemExit(f"Missing pages-dir: {pages_dir}")

    # Expand brace glob manually.
    patterns = []
    g = str(args.glob)
    if "{" in g and "}" in g and "," in g:
        prefix, rest = g.split("{", 1)
        inner, suffix = rest.split("}", 1)
        for part in inner.split(","):
            patterns.append(prefix + part.strip() + suffix)
    else:
        patterns.append(g)

    imgs: list[Path] = []
    for pat in patterns:
        imgs.extend(sorted(pages_dir.glob(pat)))
    imgs = [p for p in imgs if p.is_file()]
    if not imgs:
        raise SystemExit(f"No images matched in {pages_dir} with glob={args.glob}")

    model = YOLO(str(Path(args.model).resolve()))

    out_pages: dict[str, list[dict]] = {}
    for p in imgs:
        res = model.predict(
            source=str(p),
            imgsz=int(args.imgsz),
            conf=float(args.conf),
            device=str(args.device),
            verbose=False,
        )
        if not res:
            out_pages[p.name] = []
            continue
        r0 = res[0]
        dets: list[dict] = []
        boxes = getattr(r0, "boxes", None)
        if boxes is not None:
            xyxy = boxes.xyxy.cpu().numpy().tolist()  # type: ignore
            confs = boxes.conf.cpu().numpy().tolist()  # type: ignore
            for b, c in zip(xyxy, confs):
                dets.append(
                    {
                        "xyxy": [float(b[0]), float(b[1]), float(b[2]), float(b[3])],
                        "score": float(c),
                    }
                )
        # Sort left-to-right for stable output (reading order handled later).
        dets.sort(key=lambda d: (d["xyxy"][0], d["xyxy"][1]))
        out_pages[p.name] = dets

    out_path = Path(args.out).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out = {
        "model": str(args.model),
        "pages_dir": str(pages_dir),
        "imgsz": int(args.imgsz),
        "conf": float(args.conf),
        "pages": out_pages,
    }
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"done pages={len(out_pages)} out={out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
