#!/usr/bin/env python3

"""Export a "perfect" detections.json from an existing InkGrid dataset index.

This is useful for:

- smoke-testing the refinement pipeline without having a trained YOLO model
- establishing an upper bound on detector-guided crops

It converts `index.json` entries into `pages[page_name] = [{xyxy, score}]`.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset-dir", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--score", type=float, default=0.99)
    args = ap.parse_args()

    d = Path(args.dataset_dir).resolve()
    idx = d / "index.json"
    if not idx.exists():
        raise SystemExit(f"Missing index.json: {idx}")
    data = json.loads(idx.read_text(encoding="utf-8"))
    files = data.get("files")
    if not isinstance(files, list):
        raise SystemExit("Invalid index.json")

    pages: dict[str, list[dict]] = {}
    for e in files:
        if not isinstance(e, dict):
            continue
        src = e.get("source") or {}
        page = str(src.get("image") or "").strip()
        crop = src.get("crop_box")
        if not page or not (isinstance(crop, list) and len(crop) == 4):
            continue
        # Normalize page name: index.json often stores pages_raw/<name>
        if page.startswith("pages_raw/"):
            page = page.split("/", 1)[1]
        pages.setdefault(page, []).append(
            {
                "xyxy": [float(crop[0]), float(crop[1]), float(crop[2]), float(crop[3])],
                "score": float(args.score),
            }
        )

    # Stable ordering.
    for k in list(pages.keys()):
        pages[k].sort(key=lambda d: (d["xyxy"][0], d["xyxy"][1]))

    out_path = Path(args.out).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out = {
        "source": str(d),
        "pages": pages,
    }
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"done pages={len(pages)} out={out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
