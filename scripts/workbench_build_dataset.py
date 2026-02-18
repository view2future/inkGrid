#!/usr/bin/env python3
"""Build a simple grid-based dataset from workbench uploaded pages.

V1 goal: produce an InkGrid-consumable dataset directory:
- `index.json`
- per-char PNGs (square normalized)
- QA outputs (optional)
- page overlays (grid/crop/qa)

This script intentionally keeps dependencies minimal.
"""

from __future__ import annotations

import argparse
import json
import os
import time
import importlib.util
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def update_job(job_file: Path | None, *, stage: str, progress: int, note: str | None = None) -> None:
    if not job_file:
        return
    try:
        cur = json.loads(job_file.read_text(encoding="utf-8"))
    except Exception:
        return
    cur["status"] = "running"
    cur["stage"] = str(stage)
    cur["progress"] = int(progress)
    cur["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    if note:
        cur["log_tail"] = (str(cur.get("log_tail") or "") + "\n" + str(note)).strip()[-6000:]
    job_file.write_text(json.dumps(cur, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--stele-slug", required=True)
    ap.add_argument("--stele-dir", required=True)
    ap.add_argument("--pages-dir", required=True)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--direction", required=True, choices=["vertical_rtl", "horizontal_ltr"])
    ap.add_argument("--cols", type=int, required=True)
    ap.add_argument("--rows", type=int, required=True)
    ap.add_argument("--size", type=int, default=512)
    ap.add_argument("--inner-pad", type=int, default=30)
    ap.add_argument("--job-file", default=None)
    args = ap.parse_args()

    stele_slug = str(args.stele_slug)
    pages_dir = Path(args.pages_dir)
    out_dir = Path(args.out_dir)
    job_file = Path(args.job_file) if args.job_file else None

    if not pages_dir.exists():
        raise SystemExit(f"Missing pages dir: {pages_dir}")
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "overlays").mkdir(parents=True, exist_ok=True)

    # Reuse render_square from existing extractor for consistent output.
    # NOTE: scripts/ isn't a Python package, so import via file path.
    repo_root = Path(__file__).resolve().parent.parent
    extract_path = (repo_root / "scripts" / "extract_lantingjixu_chars.py").resolve()
    spec = importlib.util.spec_from_file_location("extract_lantingjixu_chars", extract_path)
    if spec is None or spec.loader is None:
        raise SystemExit(f"Cannot import extractor: {extract_path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    render_square = getattr(mod, "render_square")

    # Load workbench pages ordering + per-page overrides if present.
    workbench_pages: list[dict] = []
    try:
        wb_pages_path = Path(args.stele_dir) / "workbench" / "pages.json"
        if wb_pages_path.exists():
            wb = json.loads(wb_pages_path.read_text(encoding="utf-8"))
            workbench_pages = list(wb.get("pages") or [])
    except Exception:
        workbench_pages = []

    # Load alignment text (optional): if text length matches total cells,
    # use it to label outputs and set codepoints.
    align_text = ""
    try:
        align_path = Path(args.stele_dir) / "workbench" / "alignment.json"
        if align_path.exists():
            a = json.loads(align_path.read_text(encoding="utf-8"))
            align_text = str(a.get("text_trad") or "")
    except Exception:
        align_text = ""

    def cp_tag(ch: str) -> str:
        if not ch:
            return "U003F"
        cp = ord(ch)
        if cp <= 0xFFFF:
            return f"U{cp:04X}"
        return f"U{cp:06X}"

    pages = [
        p
        for p in pages_dir.iterdir()
        if p.is_file() and p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
    ]
    pages_by_name = {p.name: p for p in pages}

    ordered = []
    for e in workbench_pages:
        name = str((e or {}).get("image") or "").strip()
        p = pages_by_name.get(name)
        if p is not None:
            ordered.append(p)
    for p in sorted(pages, key=lambda x: x.name):
        if p not in ordered:
            ordered.append(p)
    pages = ordered
    if not pages:
        raise SystemExit("No page images found")

    update_job(job_file, stage="layout", progress=10, note=f"pages={len(pages)}")

    index_entries: list[dict] = []
    global_idx = 0

    for page_i, page_path in enumerate(pages, start=1):
        img = Image.open(page_path).convert("RGB")
        w, h = img.width, img.height

        page_override: dict | None = None
        for e in workbench_pages:
            if str((e or {}).get("image") or "") == page_path.name:
                page_override = (e or {}).get("override")
                break
        page_direction = str((page_override or {}).get("direction") or args.direction)
        page_cols = int((page_override or {}).get("cols") or args.cols)
        page_rows = int((page_override or {}).get("rows") or args.rows)
        if page_cols <= 0 or page_rows <= 0:
            page_cols = int(args.cols)
            page_rows = int(args.rows)

        # Build grid cell boxes.
        # Note: for V1 we assume a uniform grid; later versions can support per-page overrides.
        cell_w = w / float(page_cols)
        cell_h = h / float(page_rows)

        # Reading order
        if page_direction == "vertical_rtl":
            col_order = list(range(page_cols - 1, -1, -1))
            row_order = list(range(page_rows))
        else:
            col_order = list(range(page_cols))
            row_order = list(range(page_rows))

        overlay_grid = img.copy()
        draw = ImageDraw.Draw(overlay_grid)

        # draw grid lines
        for c in range(1, page_cols):
            x = int(round(c * cell_w))
            draw.line([(x, 0), (x, h)], fill=(0, 200, 255), width=2)
        for r in range(1, page_rows):
            y = int(round(r * cell_h))
            draw.line([(0, y), (w, y)], fill=(0, 200, 255), width=2)

        # minimal font fallback
        try:
            font = ImageFont.load_default()
        except Exception:
            font = None

        for ci, col in enumerate(col_order):
            for ri, row in enumerate(row_order):
                x0 = int(round(col * cell_w))
                x1 = int(round((col + 1) * cell_w))
                y0 = int(round(row * cell_h))
                y1 = int(round((row + 1) * cell_h))
                x1 = max(x1, x0 + 1)
                y1 = max(y1, y0 + 1)

                global_idx += 1
                crop = img.crop((x0, y0, x1, y1))
                out = render_square(
                    crop,
                    size=int(args.size),
                    inner_pad=int(args.inner_pad),
                    expected_center=(float((x1 - x0) / 2.0), float((y1 - y0) / 2.0)),
                )

                ch = align_text[global_idx - 1] if global_idx - 1 < len(align_text) else "?"
                code = cp_tag(ch)
                filename = f"{stele_slug}_{global_idx:04d}_{code}.png"
                out.save(out_dir / filename, format="PNG", optimize=True)

                # label on overlay
                if font:
                    draw.text((x0 + 4, y0 + 4), f"{global_idx:04d}", fill=(255, 255, 255), font=font)

                index_entries.append(
                    {
                        "index": global_idx,
                        "char": ch,
                        "char_trad": ch,
                        "char_simp": ch,
                        "codepoint": code.replace("U", "U+"),
                        "file": filename,
                        "source": {
                            "image": page_path.name,
                            "image_index": page_i,
                            "page_override": page_override,
                            "grid": {"col": int(col), "row": int(row)},
                            "cell_box": [x0, y0, x1, y1],
                            "crop_box": [x0, y0, x1, y1],
                        },
                    }
                )

        overlay_grid.save(
            out_dir / "overlays" / f"page_{page_i:02d}_grid.png",
            format="PNG",
            optimize=True,
        )

        # V1: crop overlay equals cell overlay (future: draw actual crop boxes).
        overlay_grid.save(
            out_dir / "overlays" / f"page_{page_i:02d}_crop.png",
            format="PNG",
            optimize=True,
        )

        update_job(job_file, stage="crop_render", progress=10 + int(70 * page_i / max(1, len(pages))))

    index = {"total_chars": len(index_entries), "files": index_entries}
    (out_dir / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    update_job(job_file, stage="qa", progress=90)

    # Optional QA if available.
    try:
        import subprocess

        qa_script = (repo_root / "scripts" / "qa_char_crops.py").resolve()
        subprocess.check_call(
            [
                "python3",
                str(qa_script),
                "--dataset-dir",
                str(out_dir),
                "--source-dir",
                str(Path(args.stele_dir)),
                "--top",
                "80",
            ]
        )
    except Exception:
        # Ignore QA errors for now.
        pass

    # QA overlay (best-effort): draw red boxes for flagged entries.
    try:
        report_path = out_dir / "qa_report.json"
        if report_path.exists():
            rep = json.loads(report_path.read_text(encoding="utf-8"))
            entries = list(rep.get("entries") or [])
            by_page: dict[str, list[dict]] = {}
            for e in entries:
                if not (e.get("flags") or []):
                    continue
                src = e.get("source") or {}
                page = src.get("image")
                box = src.get("crop_box")
                if not page or not box:
                    continue
                by_page.setdefault(str(page), []).append({"box": box, "flags": e.get("flags")})

            for page_i, page_path in enumerate(pages, start=1):
                base = Image.open(page_path).convert("RGB")
                d = ImageDraw.Draw(base)
                for it in by_page.get(page_path.name, []):
                    x0, y0, x1, y1 = [int(v) for v in it["box"]]
                    d.rectangle([x0, y0, x1, y1], outline=(255, 80, 90), width=3)
                base.save(
                    out_dir / "overlays" / f"page_{page_i:02d}_qa.png",
                    format="PNG",
                    optimize=True,
                )
    except Exception:
        pass

    update_job(job_file, stage="done", progress=100)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
