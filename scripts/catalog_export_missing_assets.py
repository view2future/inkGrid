#!/usr/bin/env python3

"""Export a CSV queue for masterpieces missing assets.

Usage:
  python3 scripts/catalog_export_missing_assets.py \
    --out catalog/upload_queue.generated.csv
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any, Dict, List


ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "frontend" / "public" / "data" / "steles.json"


def has_assets(s: Dict[str, Any]) -> bool:
    assets = s.get("assets") or {}
    cover = str(assets.get("cover") or "").strip()
    pages = assets.get("pages")
    thumbs = assets.get("pagesThumb")
    return bool(cover) or bool(pages) or bool(thumbs)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", default=str(CATALOG))
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    catalog_path = Path(args.catalog)
    data = json.loads(catalog_path.read_text(encoding="utf-8"))
    steles = list(data.get("steles", []) or [])

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    cols = [
        "id",
        "slug",
        "script_type",
        "name",
        "author",
        "dynasty",
        "year",
        "type",
        "location",
        "description",
        "knowledge_id",
        "source_pages",
        "dest_dir",
        "basename",
        "start",
        "pad",
        "ext",
        "no_thumbs",
        "copy_mode",
    ]

    rows: List[Dict[str, str]] = []
    for s in steles:
        if has_assets(s):
            continue
        sid = str(s.get("id") or "").strip()
        if not sid:
            continue
        rows.append(
            {
                "id": sid,
                "slug": sid,
                "script_type": str(s.get("script_type") or "").strip(),
                "name": str(s.get("name") or "").strip(),
                "author": str(s.get("author") or "").strip(),
                "dynasty": str(s.get("dynasty") or "").strip(),
                "year": str(s.get("year") or "").strip(),
                "type": str(s.get("type") or "").strip(),
                "location": str(s.get("location") or "").strip(),
                "description": str(s.get("description") or "").strip(),
                "knowledge_id": str(s.get("knowledge_id") or "").strip(),
                "source_pages": "",
                "dest_dir": "",
                "basename": sid,
                "start": "1",
                "pad": "3",
                "ext": ".jpg",
                "no_thumbs": "",
                "copy_mode": "copy",
            }
        )

    with out_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in rows:
            w.writerow(r)

    print("Exported missing-assets queue")
    print("- catalog:", catalog_path.relative_to(ROOT))
    print("- out:", out_path.relative_to(ROOT) if out_path.is_absolute() else out_path)
    print("- rows:", len(rows))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
