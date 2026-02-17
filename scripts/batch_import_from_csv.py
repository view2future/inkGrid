#!/usr/bin/env python3

"""Batch import uploaded masterpiece assets from a CSV queue.

The CSV format matches `catalog/upload_queue.template.csv`.

Usage:
  python3 scripts/batch_import_from_csv.py --csv catalog/upload_queue.csv
  python3 scripts/batch_import_from_csv.py --csv catalog/upload_queue.csv --dry-run
"""

from __future__ import annotations

import argparse
import csv
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

from scripts.masterpiece_import_assets import (
    DEFAULT_CATALOG,
    SCRIPT_DIR_MAP,
    find_stele,
    import_pages,
    load_catalog,
    save_catalog,
)


ROOT = Path(__file__).resolve().parents[1]


def _truthy(value: str) -> bool:
    v = str(value or "").strip().lower()
    if not v:
        return False
    return v not in {"0", "false", "no", "n"}


def _pick(row: Dict[str, str], key: str) -> str:
    return str(row.get(key, "") or "").strip()


def _to_int(value: str, default: int) -> int:
    try:
        return int(str(value).strip())
    except Exception:
        return default


@dataclass
class RowResult:
    sid: str
    ok: bool
    message: str


def process_row(
    *,
    row: Dict[str, str],
    catalog_path: Path,
    data: Dict[str, Any],
    dry_run: bool,
) -> RowResult:
    sid = _pick(row, "id")
    if not sid or sid.startswith("#"):
        return RowResult(sid=sid or "(skip)", ok=True, message="skip")

    steles: List[Dict[str, Any]] = list(data.get("steles", []) or [])
    s, idx = find_stele(steles, sid)

    creating = s is None
    if creating:
        script_type = _pick(row, "script_type")
        name = _pick(row, "name")
        if not script_type:
            return RowResult(
                sid=sid, ok=False, message="missing script_type (new entry)"
            )
        if not name:
            return RowResult(sid=sid, ok=False, message="missing name (new entry)")
        s = {
            "id": sid,
            "name": name,
            "aliases": [
                a.strip() for a in _pick(row, "aliases").split(",") if a.strip()
            ]
            or [name],
            "script_type": script_type,
            "author": _pick(row, "author") or "不可考",
            "dynasty": _pick(row, "dynasty"),
            "year": _pick(row, "year"),
            "type": _pick(row, "type"),
            "location": _pick(row, "location"),
            "total_chars": 0,
            "content": "",
            "description": _pick(row, "description"),
        }
        kid = _pick(row, "knowledge_id")
        if kid:
            s["knowledge_id"] = kid
        steles.append(s)
        idx = len(steles) - 1
    else:
        assert s is not None
        # Update metadata if provided.
        for k in [
            "name",
            "author",
            "dynasty",
            "year",
            "type",
            "location",
            "description",
            "knowledge_id",
        ]:
            v = _pick(row, k)
            if v:
                s[k] = v
        aliases = _pick(row, "aliases")
        if aliases:
            s["aliases"] = [a.strip() for a in aliases.split(",") if a.strip()]

    # Assets import.
    source_pages = _pick(row, "source_pages")
    if not source_pages:
        return RowResult(sid=sid, ok=False, message="missing source_pages")

    slug = _pick(row, "slug") or sid
    basename = _pick(row, "basename") or slug
    start = _to_int(_pick(row, "start"), 1)
    pad = _to_int(_pick(row, "pad"), 3)
    ext = _pick(row, "ext") or ".jpg"
    if not ext.startswith("."):
        ext = "." + ext
    no_thumbs = _truthy(_pick(row, "no_thumbs"))
    copy_mode = (_pick(row, "copy_mode") or "copy").lower()
    if copy_mode not in {"copy", "move"}:
        copy_mode = "copy"

    script_type = str(s.get("script_type") or "").strip()
    script_dir = SCRIPT_DIR_MAP.get(script_type)
    if not script_dir:
        return RowResult(
            sid=sid, ok=False, message=f"unknown script_type '{script_type}'"
        )

    dest_dir_raw = _pick(row, "dest_dir")
    if dest_dir_raw:
        dest_dir = Path(dest_dir_raw)
        if not dest_dir.is_absolute():
            dest_dir = (ROOT / dest_dir).resolve()
    else:
        dest_dir = (ROOT / "steles" / script_dir / f"{sid}-{slug}").resolve()

    source_dir = Path(source_pages).expanduser().resolve()

    if dry_run:
        return RowResult(sid=sid, ok=True, message=f"dry-run -> {dest_dir}")

    result = import_pages(
        source_dir=source_dir,
        dest_dir=dest_dir,
        basename=basename,
        start=start,
        pad=pad,
        ext=ext,
        copy_mode=copy_mode,
        generate_thumbs=not no_thumbs,
        thumb_width=_to_int(_pick(row, "thumb_width"), 320),
        thumb_quality=_to_int(_pick(row, "thumb_quality"), 78),
    )

    dest_url_dir = "/" + str(result.dest_dir.relative_to(ROOT)).replace("\\", "/")
    cover_url = f"{dest_url_dir}/{result.page_files[0].name}"
    pages_end = start + len(result.page_files) - 1
    pages_pattern = f"{dest_url_dir}/{basename}-{{n}}{ext}"

    assets: Dict[str, Any] = dict(s.get("assets") or {})
    assets["cover"] = cover_url
    assets["pages"] = {
        "pattern": pages_pattern,
        "start": start,
        "end": pages_end,
        "pad": pad,
    }

    if not no_thumbs:
        thumbs_url_dir = f"{dest_url_dir}/thumbs"
        thumbs_pattern = f"{thumbs_url_dir}/{basename}-{{n}}{ext}"
        assets["pagesThumb"] = {
            "pattern": thumbs_pattern,
            "start": start,
            "end": pages_end,
            "pad": pad,
        }

    s["assets"] = assets

    steles[idx] = s
    data["steles"] = steles
    save_catalog(catalog_path, data)
    return RowResult(
        sid=sid, ok=True, message=f"imported {len(result.page_files)} pages"
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True, help="CSV queue file")
    parser.add_argument(
        "--catalog", default=str(DEFAULT_CATALOG), help="Path to steles.json"
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    csv_path = Path(args.csv)
    if not csv_path.exists():
        raise SystemExit(f"CSV not found: {csv_path}")

    catalog_path = Path(args.catalog)
    if not catalog_path.exists():
        raise SystemExit(f"Catalog not found: {catalog_path}")

    data = load_catalog(catalog_path)

    ok = 0
    fail = 0
    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rr = process_row(
                row=row,
                catalog_path=catalog_path,
                data=data,
                dry_run=bool(args.dry_run),
            )
            if rr.message == "skip":
                continue
            if rr.ok:
                ok += 1
                print(f"[OK] {rr.sid}: {rr.message}")
            else:
                fail += 1
                print(f"[FAIL] {rr.sid}: {rr.message}")

    print()
    print("Done")
    print("- ok:", ok)
    print("- fail:", fail)
    return 1 if fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
