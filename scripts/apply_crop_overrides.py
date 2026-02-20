#!/usr/bin/env python3
"""Apply manual crop_box overrides to an existing dataset.

This is designed for the web annotator workflow:
- AI generates a dataset with index.json
- Human adjusts crop boxes (page coordinates)
- This script re-renders only the affected PNGs and updates index.json

Notes:
- Overrides format:

  {
    "version": 1,
    "crop_overrides": {
      "<file.png>": {"crop_box": [x0,y0,x1,y1], "note": "..."}
    }
  }

"""

from __future__ import annotations

import argparse
import importlib
import json
import importlib.util
import sys
from pathlib import Path

from PIL import Image


def _load_render_square(repo_root: Path):
    extract_path = (repo_root / "scripts" / "extract_lantingjixu_chars.py").resolve()
    spec = importlib.util.spec_from_file_location("extract_lantingjixu_chars", extract_path)
    if spec is None or spec.loader is None:
        raise SystemExit("cannot import extractor")
    mod = importlib.util.module_from_spec(spec)
    # Python 3.14 dataclasses expects the module to exist in sys.modules.
    sys.modules[str(spec.name)] = mod
    spec.loader.exec_module(mod)
    return getattr(mod, "render_square")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset-dir", required=True)
    parser.add_argument("--source-dir", required=True)
    parser.add_argument("--overrides", required=True)
    parser.add_argument(
        "--only-files",
        default=None,
        help="Comma-separated list of files to apply (default: all overrides)",
    )
    parser.add_argument(
        "--size",
        type=int,
        default=512,
        help="Output size (must match dataset)",
    )
    parser.add_argument(
        "--inner-pad",
        type=int,
        default=30,
        help="Inner padding (must match dataset)",
    )
    args = parser.parse_args()

    dataset_dir = Path(args.dataset_dir)
    source_dir = Path(args.source_dir)
    overrides_path = Path(args.overrides)

    index_path = dataset_dir / "index.json"
    if not index_path.exists():
        raise SystemExit(f"Missing index.json: {index_path}")
    if not overrides_path.exists():
        raise SystemExit(f"Missing overrides: {overrides_path}")

    index = json.loads(index_path.read_text(encoding="utf-8"))
    entries = list(index.get("files", []) or [])
    by_file = {e.get("file"): e for e in entries if e.get("file")}

    meta_out = (index.get("meta") or {}).get("output") if isinstance(index.get("meta"), dict) else None
    output_format = None
    output_quality = None
    if isinstance(meta_out, dict):
        output_format = str(meta_out.get("format") or "").lower().strip() or None
        try:
            output_quality = int(meta_out.get("quality")) if meta_out.get("quality") is not None else None
        except Exception:
            output_quality = None

    overrides = json.loads(overrides_path.read_text(encoding="utf-8"))
    crop_overrides = overrides.get("crop_overrides") or {}
    if not isinstance(crop_overrides, dict):
        raise SystemExit("Invalid overrides: crop_overrides must be an object")

    only = None
    if args.only_files:
        only = {s.strip() for s in str(args.only_files).split(",") if s.strip()}

    # Import render_square from lanting extractor for consistent output.
    repo_root = Path(__file__).resolve().parent.parent
    render_square = _load_render_square(repo_root)

    page_cache: dict[str, Image.Image] = {}

    def load_page(name: str) -> Image.Image:
        if name not in page_cache:
            cand = [source_dir / name]
            # Common prefix in index.json.
            if str(name).startswith("pages_raw/"):
                cand.append(source_dir / str(name).split("/", 1)[1])
            cand.append(source_dir / "pages_raw" / name)
            p = None
            for c in cand:
                if c.exists():
                    p = c
                    break
            if p is None:
                raise FileNotFoundError(f"Missing source image: {source_dir / name}")
            page_cache[name] = Image.open(p).convert("RGB")
        return page_cache[name]

    updated = 0
    for fn, spec in crop_overrides.items():
        if only is not None and fn not in only:
            continue
        if fn not in by_file:
            continue
        if not isinstance(spec, dict):
            continue
        crop_box = spec.get("crop_box")
        if (
            not isinstance(crop_box, list)
            or len(crop_box) != 4
            or not all(isinstance(v, (int, float)) for v in crop_box)
        ):
            continue

        e = by_file[fn]
        src = e.get("source") or {}
        page_name = src.get("image")
        cell_box = src.get("cell_box")
        if not page_name or not cell_box:
            continue

        x0, y0, x1, y1 = [int(round(float(v))) for v in crop_box]
        page = load_page(page_name)
        x0 = max(0, min(x0, page.width - 1))
        x1 = max(x0 + 1, min(x1, page.width))
        y0 = max(0, min(y0, page.height - 1))
        y1 = max(y0 + 1, min(y1, page.height))

        crop = page.crop((x0, y0, x1, y1))

        exp_cx = ((cell_box[0] + cell_box[2]) / 2.0) - float(x0)
        exp_cy = ((cell_box[1] + cell_box[3]) / 2.0) - float(y0)
        out = render_square(
            crop,
            size=int(args.size),
            inner_pad=int(args.inner_pad),
            expected_center=(float(exp_cx), float(exp_cy)),
        )

        out_path = dataset_dir / fn
        ext = out_path.suffix.lower()
        fmt = output_format or ("webp" if ext == ".webp" else "png")
        if fmt == "webp" or ext == ".webp":
            q = int(output_quality or 82)
            out.save(out_path, format="WEBP", quality=q, method=6)
        else:
            out.save(out_path, format="PNG", optimize=True)

        # Update index.json crop_box.
        src["crop_box"] = [int(x0), int(y0), int(x1), int(y1)]
        e["source"] = src
        updated += 1

    if updated:
        index_path.write_text(
            json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )

    print(f"Applied overrides to {updated} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
