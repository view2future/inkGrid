#!/usr/bin/env python3

"""Import uploaded masterpiece page images into InkGrid.

This script standardizes page filenames, generates thumbnails, and
updates `frontend/public/data/steles.json` with `assets` fields.

Typical workflow:
1) Put your raw page images in a folder (any filenames).
2) Run this script with `--id` and `--source-pages`.
3) Run `python3 scripts/catalog_validate.py` to sanity check.
4) Run `npm run build` in `frontend/`.

Example:
  python3 scripts/masterpiece_import_assets.py \
    --id xing_001 \
    --slug lantingxu \
    --script-type 行书 \
    --name 兰亭序 \
    --author 王羲之 \
    --dynasty 东晋 \
    --type 墨迹 \
    --location 故宫博物院（神龙本） \
    --description "行书第一，飘若浮云、矫若惊龙。" \
    --source-pages "/path/to/pages"
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CATALOG = ROOT / "frontend" / "public" / "data" / "steles.json"


SCRIPT_DIR_MAP: Dict[str, str] = {
    "篆书": "1-zhuanshu",
    "隶书": "2-lishu",
    "楷书": "3-kaishu",
    "行书": "4-xingshu",
    "草书": "5-caoshu",
}


IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}


def _natural_key(p: Path) -> List[Any]:
    parts = re.split(r"(\d+)", p.name)
    out: List[Any] = []
    for s in parts:
        if not s:
            continue
        if s.isdigit():
            out.append(int(s))
        else:
            out.append(s.lower())
    return out


def _to_url_from_root_path(path: Path) -> str:
    rel = path.resolve().relative_to(ROOT.resolve())
    return "/" + str(rel).replace("\\", "/")


def _ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def _resize_to_width(img: Image.Image, width: int) -> Image.Image:
    w, h = img.size
    if w <= 0 or h <= 0:
        return img
    if w <= width:
        return img
    new_h = max(1, int(round(h * (width / float(w)))))
    return img.resize((width, new_h), Image.Resampling.LANCZOS)


@dataclass
class ImportResult:
    dest_dir: Path
    page_files: List[Path]
    thumb_files: List[Path]


def import_pages(
    *,
    source_dir: Path,
    dest_dir: Path,
    basename: str,
    start: int,
    pad: int,
    ext: str,
    copy_mode: str,
    generate_thumbs: bool,
    thumb_width: int,
    thumb_quality: int,
) -> ImportResult:
    if not source_dir.exists() or not source_dir.is_dir():
        raise SystemExit(f"Source pages directory not found: {source_dir}")

    dest_dir.mkdir(parents=True, exist_ok=True)
    thumbs_dir = dest_dir / "thumbs"
    if generate_thumbs:
        thumbs_dir.mkdir(parents=True, exist_ok=True)

    src_images = [
        p
        for p in source_dir.iterdir()
        if p.is_file() and p.suffix.lower() in IMAGE_EXTS and not p.name.startswith(".")
    ]
    src_images.sort(key=_natural_key)
    if not src_images:
        raise SystemExit(f"No images found in: {source_dir}")

    page_files: List[Path] = []
    thumb_files: List[Path] = []

    for i, src in enumerate(src_images):
        n = start + i
        token = str(n).zfill(pad) if pad > 0 else str(n)
        filename = f"{basename}-{token}{ext}"
        dest = dest_dir / filename

        _ensure_parent(dest)
        try:
            same_file = src.resolve() == dest.resolve()
        except Exception:
            same_file = False

        if not same_file:
            if copy_mode == "move":
                shutil.move(str(src), str(dest))
            else:
                shutil.copy2(str(src), str(dest))
        page_files.append(dest)

        if generate_thumbs:
            thumb_path = thumbs_dir / filename
            try:
                with Image.open(dest) as im:
                    im = im.convert("RGB")
                    thumb = _resize_to_width(im, thumb_width)
                    out_ext = ext.lower()
                    if out_ext in {".jpg", ".jpeg"}:
                        thumb.save(
                            thumb_path,
                            format="JPEG",
                            quality=thumb_quality,
                            optimize=True,
                        )
                    else:
                        thumb.save(thumb_path, format="PNG", optimize=True)
                thumb_files.append(thumb_path)
            except Exception as e:
                raise SystemExit(f"Failed to create thumbnail for {dest.name}: {e}")

    return ImportResult(
        dest_dir=dest_dir, page_files=page_files, thumb_files=thumb_files
    )


def load_catalog(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def save_catalog(path: Path, data: Dict[str, Any]) -> None:
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def find_stele(
    steles: List[Dict[str, Any]], sid: str
) -> Tuple[Optional[Dict[str, Any]], int]:
    for idx, s in enumerate(steles):
        if str(s.get("id") or "").strip() == sid:
            return s, idx
    return None, -1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--catalog", default=str(DEFAULT_CATALOG), help="Path to steles.json"
    )
    parser.add_argument("--id", required=True, help="Masterpiece id (e.g. xing_001)")
    parser.add_argument("--slug", default="", help="ASCII slug for folder + filenames")

    parser.add_argument(
        "--script-type",
        default="",
        help="篆书/隶书/楷书/行书/草书 (required if creating new entry)",
    )
    parser.add_argument(
        "--name", default="", help="Work name (required if creating new entry)"
    )
    parser.add_argument("--aliases", default="", help="Comma-separated aliases")
    parser.add_argument("--author", default="", help="Author")
    parser.add_argument("--dynasty", default="", help="Dynasty")
    parser.add_argument("--year", default="", help="Year")
    parser.add_argument("--type", default="", help="Type: 碑刻/墨迹/刻帖...")
    parser.add_argument("--location", default="", help="Location")
    parser.add_argument("--description", default="", help="1-line description")

    parser.add_argument(
        "--knowledge-id", default="", help="Optional explicit knowledge_id"
    )

    parser.add_argument(
        "--source-pages", required=True, help="Directory containing raw page images"
    )
    parser.add_argument(
        "--dest-dir",
        default="",
        help="Destination directory (default: steles/<script_dir>/<id>-<slug>/)",
    )
    parser.add_argument(
        "--basename", default="", help="Output page basename (default: slug or id)"
    )
    parser.add_argument("--start", type=int, default=1, help="Start page number")
    parser.add_argument("--pad", type=int, default=3, help="Zero pad length")
    parser.add_argument(
        "--ext", default=".jpg", help="Output extension (.jpg recommended)"
    )
    parser.add_argument("--copy-mode", choices=["copy", "move"], default="copy")
    parser.add_argument(
        "--no-thumbs", action="store_true", help="Do not generate thumbnails"
    )
    parser.add_argument("--thumb-width", type=int, default=320)
    parser.add_argument("--thumb-quality", type=int, default=78)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    sid = str(args.id).strip()
    if not sid:
        raise SystemExit("--id is required")

    catalog_path = Path(args.catalog)
    if not catalog_path.exists():
        raise SystemExit(f"Catalog not found: {catalog_path}")

    data = load_catalog(catalog_path)
    steles = list(data.get("steles", []) or [])

    existing, idx = find_stele(steles, sid)

    creating = existing is None
    if creating:
        script_type = str(args.script_type).strip()
        name = str(args.name).strip()
        if not script_type:
            raise SystemExit("--script-type is required when creating a new entry")
        if not name:
            raise SystemExit("--name is required when creating a new entry")

        existing = {
            "id": sid,
            "name": name,
            "aliases": [a.strip() for a in str(args.aliases).split(",") if a.strip()]
            or [name],
            "script_type": script_type,
            "author": str(args.author).strip() or "不可考",
            "dynasty": str(args.dynasty).strip() or "",
            "year": str(args.year).strip() or "",
            "type": str(args.type).strip() or "",
            "location": str(args.location).strip() or "",
            "total_chars": 0,
            "content": "",
            "description": str(args.description).strip() or "",
        }
        if args.knowledge_id:
            existing["knowledge_id"] = str(args.knowledge_id).strip()

        steles.append(existing)
        idx = len(steles) - 1

    # Determine dest directory.
    slug = str(args.slug).strip() or sid
    script_type = str(
        existing.get("script_type") or str(args.script_type) or ""
    ).strip()
    script_dir = SCRIPT_DIR_MAP.get(script_type)
    if not script_dir:
        raise SystemExit(
            f"Unknown script_type '{script_type}'. Expected one of: {', '.join(SCRIPT_DIR_MAP.keys())}"
        )

    if args.dest_dir:
        dest_dir = Path(args.dest_dir)
        if not dest_dir.is_absolute():
            dest_dir = (ROOT / dest_dir).resolve()
    else:
        dest_dir = (ROOT / "steles" / script_dir / f"{sid}-{slug}").resolve()

    basename = str(args.basename).strip() or slug
    ext = str(args.ext).strip()
    if not ext.startswith("."):
        ext = "." + ext

    source_dir = Path(args.source_pages).expanduser().resolve()

    if args.dry_run:
        print("[DRY RUN]")
        print("- id:", sid)
        print("- creating:", creating)
        print("- script_type:", script_type)
        print("- source:", source_dir)
        print("- dest:", dest_dir)
        print("- basename:", basename)
        return 0

    result = import_pages(
        source_dir=source_dir,
        dest_dir=dest_dir,
        basename=basename,
        start=int(args.start),
        pad=int(args.pad),
        ext=ext,
        copy_mode=str(args.copy_mode),
        generate_thumbs=not bool(args.no_thumbs),
        thumb_width=int(args.thumb_width),
        thumb_quality=int(args.thumb_quality),
    )

    # Update catalog assets.
    pages_start = int(args.start)
    pages_end = pages_start + len(result.page_files) - 1

    dest_url_dir = _to_url_from_root_path(result.dest_dir)
    cover_url = f"{dest_url_dir}/{result.page_files[0].name}"
    pages_pattern = f"{dest_url_dir}/{basename}-{{n}}{ext}"

    assets: Dict[str, Any] = dict(existing.get("assets") or {})
    assets["cover"] = cover_url
    assets["pages"] = {
        "pattern": pages_pattern,
        "start": pages_start,
        "end": pages_end,
        "pad": int(args.pad),
    }

    thumbs_pattern: Optional[str] = None
    if not args.no_thumbs:
        thumbs_url_dir = f"{dest_url_dir}/thumbs"
        thumbs_pattern = f"{thumbs_url_dir}/{basename}-{{n}}{ext}"
        assets["pagesThumb"] = {
            "pattern": thumbs_pattern,
            "start": pages_start,
            "end": pages_end,
            "pad": int(args.pad),
        }

    existing["assets"] = assets
    if args.knowledge_id:
        existing["knowledge_id"] = str(args.knowledge_id).strip()

    steles[idx] = existing
    data["steles"] = steles
    save_catalog(catalog_path, data)

    print("Imported pages:")
    print("- id:", sid)
    print("- dest_dir:", result.dest_dir.relative_to(ROOT))
    print(
        "- pages:",
        len(result.page_files),
        f"({result.page_files[0].name} .. {result.page_files[-1].name})",
    )
    if not args.no_thumbs:
        print("- thumbs:", len(result.thumb_files))
    print("Updated catalog:")
    print("-", catalog_path.relative_to(ROOT))
    print("- assets.cover:", cover_url)
    print("- assets.pages.pattern:", pages_pattern)
    if thumbs_pattern:
        print("- assets.pagesThumb.pattern:", thumbs_pattern)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
