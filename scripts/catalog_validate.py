#!/usr/bin/env python3

"""Validate InkGrid masterpiece catalog.

Checks:
- JSON validity
- Duplicate IDs
- Knowledge linkage (by knowledge_id or id)
- Assets paths exist on disk (for /steles/* URLs)

Usage:
  python3 scripts/catalog_validate.py
  python3 scripts/catalog_validate.py --fail-on-missing-assets
"""

from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


ROOT = Path(__file__).resolve().parents[1]
STELES_JSON = ROOT / "frontend" / "public" / "data" / "steles.json"
KNOWLEDGE_JSON = ROOT / "frontend" / "public" / "data" / "stele_knowledge.json"
STELES_DIR = ROOT / "steles"


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_name_key(value: str) -> str:
    return (
        str(value or "")
        .strip()
        .replace(" ", "")
        .replace("·", "")
        .replace("・", "")
        .replace("．", "")
        .replace("。", "")
        .replace("，", "")
        .replace(",", "")
        .replace("、", "")
        .replace(":", "")
        .replace("：", "")
        .replace(";", "")
        .replace("；", "")
        .replace("（", "(")
        .replace("）", ")")
        .replace("《", "")
        .replace("》", "")
        .lower()
    )


def iter_asset_urls(stele: Dict[str, Any]) -> Iterable[str]:
    assets = stele.get("assets") or {}
    cover = assets.get("cover")
    if isinstance(cover, str) and cover.strip():
        yield cover.strip()

    def iter_pages(value: Any) -> Iterable[str]:
        if isinstance(value, list):
            for p in value:
                if isinstance(p, str) and p.strip():
                    yield p.strip()
            return
        if isinstance(value, dict):
            pattern = str(value.get("pattern") or "").strip()
            start = value.get("start")
            end = value.get("end")
            pad = value.get("pad")
            try:
                start_n = int(str(start)) if start is not None else 0
                end_n = int(str(end)) if end is not None else 0
                pad_n = int(str(pad)) if pad is not None else 0
            except Exception:
                start_n = end_n = pad_n = 0

            if pattern and start is not None and end is not None:
                step = 1 if start_n <= end_n else -1
                n = start_n
                while n <= end_n if step > 0 else n >= end_n:
                    s = str(n).zfill(pad_n) if pad_n > 0 else str(n)
                    yield pattern.replace("{n}", s)
                    n += step

    yield from iter_pages(assets.get("pages"))
    yield from iter_pages(assets.get("pagesThumb"))

    practice = assets.get("practice")
    if isinstance(practice, list):
        for item in practice:
            if not isinstance(item, dict):
                continue
            img = item.get("image")
            if isinstance(img, str) and img.strip():
                yield img.strip()


def url_to_path(url: str) -> Optional[Path]:
    if not url.startswith("/steles/"):
        return None
    rel = url.lstrip("/")
    return ROOT / rel


@dataclass
class Report:
    total: int
    duplicate_ids: List[str]
    missing_knowledge: List[str]
    missing_assets: List[str]
    broken_asset_paths: List[Tuple[str, str]]


def validate() -> Report:
    steles_raw = read_json(STELES_JSON)
    knowledge_raw = read_json(KNOWLEDGE_JSON)

    steles = list(steles_raw.get("steles", []) or [])
    knowledge = list(knowledge_raw.get("steles", []) or [])

    knowledge_by_id = {str(k.get("id")): k for k in knowledge if k.get("id")}
    knowledge_by_name_key = {
        normalize_name_key(str(k.get("name") or "")): k
        for k in knowledge
        if k.get("name")
    }

    seen: Dict[str, int] = {}
    duplicates: List[str] = []
    missing_knowledge: List[str] = []
    missing_assets: List[str] = []
    broken_assets: List[Tuple[str, str]] = []

    for s in steles:
        sid = str(s.get("id") or "").strip()
        if not sid:
            continue
        seen[sid] = seen.get(sid, 0) + 1

        # knowledge
        kid = str(s.get("knowledge_id") or "").strip() or sid
        if kid not in knowledge_by_id:
            name_key = normalize_name_key(str(s.get("name") or ""))
            if name_key not in knowledge_by_name_key:
                missing_knowledge.append(sid)

        # assets
        assets = s.get("assets") or {}
        cover = str(assets.get("cover") or "").strip()
        pages = assets.get("pages")
        thumbs = assets.get("pagesThumb")
        has_pages = bool(pages) or bool(thumbs)
        if not cover and not has_pages:
            missing_assets.append(sid)

        for url in iter_asset_urls(s):
            p = url_to_path(url)
            if not p:
                continue
            if not p.exists():
                broken_assets.append((sid, url))

    for sid, n in seen.items():
        if n > 1:
            duplicates.append(sid)

    return Report(
        total=len(steles),
        duplicate_ids=sorted(duplicates),
        missing_knowledge=sorted(set(missing_knowledge)),
        missing_assets=sorted(set(missing_assets)),
        broken_asset_paths=sorted(broken_assets),
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fail-on-missing-assets", action="store_true")
    parser.add_argument("--fail-on-missing-knowledge", action="store_true")
    parser.add_argument("--fail-on-broken-assets", action="store_true")
    args = parser.parse_args()

    report = validate()

    print("InkGrid Catalog Validation")
    print("- catalog:", os.path.relpath(STELES_JSON, ROOT))
    print("- knowledge:", os.path.relpath(KNOWLEDGE_JSON, ROOT))
    print("- steles dir:", os.path.relpath(STELES_DIR, ROOT))
    print()
    print("Total masterpieces:", report.total)
    print("Duplicate IDs:", len(report.duplicate_ids))
    print("Missing knowledge:", len(report.missing_knowledge))
    print("Missing assets:", len(report.missing_assets))
    print("Broken asset paths:", len(report.broken_asset_paths))
    print()

    if report.duplicate_ids:
        print("Duplicate IDs:")
        for sid in report.duplicate_ids:
            print(" ", sid)
        print()

    if report.missing_knowledge:
        print("Missing knowledge (no matching id/name):")
        for sid in report.missing_knowledge[:50]:
            print(" ", sid)
        if len(report.missing_knowledge) > 50:
            print("  ...")
        print()

    if report.missing_assets:
        print("Missing assets (no cover/pages):")
        for sid in report.missing_assets[:50]:
            print(" ", sid)
        if len(report.missing_assets) > 50:
            print("  ...")
        print()

    if report.broken_asset_paths:
        print("Broken asset paths:")
        for sid, url in report.broken_asset_paths[:80]:
            print(f"  {sid}: {url}")
        if len(report.broken_asset_paths) > 80:
            print("  ...")
        print()

    failed = False
    if args.fail_on_missing_assets and report.missing_assets:
        failed = True
    if args.fail_on_missing_knowledge and report.missing_knowledge:
        failed = True
    if args.fail_on_broken_assets and report.broken_asset_paths:
        failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
