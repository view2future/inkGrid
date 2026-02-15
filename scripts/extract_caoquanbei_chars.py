#!/usr/bin/env python3
"""Extract Caoquanbei (曹全碑) characters into single images.

This script reads the segmented rubbing images in:
  steles/2-lishu/1-caoquanbei/caoquanbei-*.jpg

Each image is assumed to be a 3 (columns) x 6 (rows) grid.
Reading order per image: right column top->bottom, then middle, then left.

It labels characters using the Wikisource raw text for the碑陽 section.
Output:
  - One PNG per character
  - index.json mapping each file to its character and source location

Default output directory:
  steles/2-lishu/1-caoquanbei/chars_yang/
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path

from PIL import Image, ImageEnhance


WIKISOURCE_RAW_URL = (
    "https://zh.wikisource.org/w/index.php?title=%E6%9B%B9%E5%85%A8%E7%A2%91&action=raw"
)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--input-dir",
        default="steles/2-lishu/1-caoquanbei",
        help="Directory containing caoquanbei-*.jpg",
    )
    parser.add_argument(
        "--output-dir",
        default="steles/2-lishu/1-caoquanbei/chars_yang",
        help="Output directory for single-character images",
    )
    parser.add_argument(
        "--size",
        type=int,
        default=256,
        help="Output image size (square)",
    )
    parser.add_argument(
        "--inner-pad",
        type=int,
        default=18,
        help="Padding inside the output canvas",
    )
    parser.add_argument(
        "--cell-margin-x",
        type=float,
        default=0.07,
        help="Margin ratio to trim inside each cell (x)",
    )
    parser.add_argument(
        "--cell-margin-y",
        type=float,
        default=0.08,
        help="Margin ratio to trim inside each cell (y)",
    )
    parser.add_argument(
        "--contrast",
        type=float,
        default=1.12,
        help="Contrast boost for the cropped glyph",
    )
    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    def image_sort_key(p: Path) -> int:
        m = re.search(r"(\d+)$", p.stem)
        if not m:
            return 0
        return int(m.group(1))

    image_paths = sorted(
        input_dir.glob("caoquanbei-*.jpg"),
        key=image_sort_key,
    )
    if not image_paths:
        raise SystemExit(f"No caoquanbei-*.jpg found in {input_dir}")

    yang_text = extract_caoquanbei_yang_text(fetch_raw(WIKISOURCE_RAW_URL))
    chunks = [yang_text[i : i + 18] for i in range(0, len(yang_text), 18)]

    used_chunks, skipped = align_chunks_to_images(chunks, len(image_paths))

    index_entries: list[dict] = []
    global_idx = 0

    for img_i, img_path in enumerate(image_paths, start=1):
        chunk = used_chunks[img_i - 1]
        img = Image.open(img_path).convert("RGB")

        # Allow minor size differences; compute fractional grid edges.
        x_edges = [int(round(i * img.width / 3)) for i in range(4)]
        y_edges = [int(round(i * img.height / 6)) for i in range(7)]

        for j, ch in enumerate(chunk):
            global_idx += 1
            read_col = j // 6  # 0: rightmost, 1: middle, 2: leftmost
            row = j % 6
            col = 2 - read_col

            cell_x0 = x_edges[col]
            cell_x1 = x_edges[col + 1]
            cell_y0 = y_edges[row]
            cell_y1 = y_edges[row + 1]

            cell_w = max(1, cell_x1 - cell_x0)
            cell_h = max(1, cell_y1 - cell_y0)
            mx = max(0, int(cell_w * float(args.cell_margin_x)))
            my = max(0, int(cell_h * float(args.cell_margin_y)))

            x0 = cell_x0 + mx
            y0 = cell_y0 + my
            x1 = cell_x1 - mx
            y1 = cell_y1 - my

            crop = img.crop((x0, y0, x1, y1))
            if args.contrast and args.contrast != 1:
                crop = ImageEnhance.Contrast(crop).enhance(float(args.contrast))

            out = render_square(
                crop, size=int(args.size), inner_pad=int(args.inner_pad)
            )

            code = format_codepoint(ch)
            filename = f"caoquanbei_yang_{global_idx:04d}_{code}.png"
            out_path = output_dir / filename
            out.save(out_path, format="PNG", optimize=True)

            index_entries.append(
                {
                    "index": global_idx,
                    "char": ch,
                    "codepoint": f"U+{ord(ch):X}",
                    "file": filename,
                    "source": {
                        "image": img_path.name,
                        "image_index": img_i,
                        "chunk": chunk,
                        "pos_in_chunk": j,
                        "grid": {"col": col, "row": row},
                        "crop_box": [x0, y0, x1, y1],
                    },
                }
            )

    with (output_dir / "index.json").open("w", encoding="utf-8") as f:
        json.dump(
            {
                "name": "曹全碑 · 碑阳",
                "total_images": len(image_paths),
                "total_chars": global_idx,
                "skipped_chunk": skipped,
                "files": index_entries,
            },
            f,
            ensure_ascii=False,
            indent=2,
        )

    with (output_dir / "text.txt").open("w", encoding="utf-8") as f:
        f.write("".join(used_chunks))

    print(f"Wrote {global_idx} character images to {output_dir}")
    if skipped:
        print(
            f"Note: one 18-char chunk is missing in the source images: {skipped['text']}"
        )
    return 0


def fetch_raw(url: str) -> str:
    return subprocess.check_output(["curl", "-L", "-sS", url], text=True)


def extract_section(raw: str, start_markers: list[str], end_markers: list[str]) -> str:
    start = -1
    start_marker = None
    for m in start_markers:
        start = raw.find(m)
        if start != -1:
            start_marker = m
            break
    if start == -1 or start_marker is None:
        raise ValueError("Cannot find section start")
    start += len(start_marker)

    end = -1
    for m in end_markers:
        end = raw.find(m, start)
        if end != -1:
            break

    return raw[start:] if end == -1 else raw[start:end]


def extract_caoquanbei_yang_text(raw_wikitext: str) -> str:
    section = extract_section(
        raw_wikitext, ["==碑陽==", "==碑阳=="], ["==碑陰==", "==碑阴=="]
    )

    # Common templates
    section = re.sub(r"\{\{YL\|([^}]+)\}\}", r"\1", section)
    section = re.sub(r"\{\{僻字\|([^|}]+)(?:\|[^}]+)?\}\}", r"\1", section)
    # Remove remaining templates
    section = re.sub(r"\{\{[^}]+\}\}", "", section)
    # Remove emphasis markers
    section = section.replace("'''", "").replace("''", "")

    # Strip whitespace/punctuation
    section = re.sub(r"[\s，。；、「」『』【】《》〈〉（）()]+", "", section)
    section = re.sub(r"[0-9A-Za-z\[\]=·\-—:：,\.]+", "", section)
    section = re.sub(r"[！？，．…、；：]+", "", section)
    text = section.strip()

    if not text:
        raise ValueError("Empty 碑陽 text after cleaning")
    return text


def align_chunks_to_images(chunks: list[str], image_count: int):
    if image_count == len(chunks):
        return chunks, None

    # The current repo has 47 images but 48 text chunks (849 chars).
    # It is missing one 18-char chunk between images 025 and 026.
    if image_count == len(chunks) - 1:
        skip_idx = 25  # 1-based: 26
        skipped = {"chunk_index": skip_idx + 1, "text": chunks[skip_idx]}
        used = chunks[:skip_idx] + chunks[skip_idx + 1 :]
        return used, skipped

    raise ValueError(
        f"Cannot align: {image_count} images vs {len(chunks)} chunks. "
        "Either add the missing image, or adjust the alignment rules."
    )


def format_codepoint(ch: str) -> str:
    cp = ord(ch)
    if cp <= 0xFFFF:
        return f"U{cp:04X}"
    if cp <= 0xFFFFF:
        return f"U{cp:05X}"
    return f"U{cp:06X}"


def render_square(img: Image.Image, size: int, inner_pad: int):
    bg = (10, 10, 12)
    canvas = Image.new("RGB", (size, size), bg)

    max_w = max(1, size - inner_pad * 2)
    max_h = max(1, size - inner_pad * 2)
    scale = min(max_w / img.width, max_h / img.height)
    new_w = max(1, int(round(img.width * scale)))
    new_h = max(1, int(round(img.height * scale)))
    resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    x = (size - new_w) // 2
    y = (size - new_h) // 2
    canvas.paste(resized, (x, y))
    return canvas


if __name__ == "__main__":
    raise SystemExit(main())
