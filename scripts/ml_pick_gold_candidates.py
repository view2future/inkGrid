#!/usr/bin/env python3

"""Pick top-N hard cases from a QA report for manual labeling.

Workflow:

1) Run QA on an existing char-crop dataset:

   python3 scripts/qa_char_crops.py --dataset-dir <chars_dir> --source-dir <stele_dir>

2) Pick candidates:

   python3 scripts/ml_pick_gold_candidates.py --qa-report <chars_dir>/qa_report.json --out out.csv --top 200

The output is a flat CSV list you can use to drive weekly 200-sample corrections.
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--qa-report", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--top", type=int, default=200)
    ap.add_argument(
        "--must-flag",
        action="append",
        default=[
            "clipped_outer_ring",
            "clipped_left",
            "clipped_right",
            "clipped_top",
            "clipped_bottom",
        ],
        help="Only include entries with any of these flags (repeatable)",
    )
    args = ap.parse_args()

    report_path = Path(args.qa_report)
    data = json.loads(report_path.read_text(encoding="utf-8"))
    entries = data.get("entries")
    if not isinstance(entries, list):
        raise SystemExit("Invalid qa_report.json: missing entries")

    must_flags = {str(x) for x in (args.must_flag or []) if str(x).strip()}

    def include(e: dict[str, Any]) -> bool:
        flags = e.get("flags") or []
        if not isinstance(flags, list):
            return False
        if not must_flags:
            return bool(flags)
        return any(str(f) in must_flags for f in flags)

    filtered: list[dict[str, Any]] = []
    for e in entries:
        if not isinstance(e, dict):
            continue
        if include(e):
            filtered.append(e)

    filtered.sort(key=lambda x: float(x.get("score") or 0.0), reverse=True)
    top_n = int(max(1, min(len(filtered), int(args.top)))) if filtered else 0
    picked = filtered[:top_n]

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with out_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "rank",
                "score",
                "flags",
                "suggestions",
                "index",
                "char",
                "file",
                "page",
                "crop_box",
            ]
        )
        for i, e in enumerate(picked, start=1):
            src = e.get("source") or {}
            w.writerow(
                [
                    i,
                    float(e.get("score") or 0.0),
                    "|".join([str(x) for x in (e.get("flags") or [])]),
                    "|".join([str(x) for x in (e.get("suggestions") or [])]),
                    int(e.get("index") or 0),
                    str(e.get("char") or ""),
                    str(e.get("file") or ""),
                    str(src.get("page") or src.get("image") or ""),
                    json.dumps(src.get("crop_box"), ensure_ascii=False),
                ]
            )

    print(f"done picked={len(picked)} out={out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
