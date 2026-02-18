#!/usr/bin/env python3

"""Build point->glyph evidence mapping for Caoquanbei.

This is a heuristic first pass to bind each of the 10 appreciation points
to a small set of glyph examples (glyphIds) so that users can tap "看例".

It uses high-frequency characters from `index.json` (by occurrence count)
and assigns each point a different high-frequency character, taking the
first N glyph occurrences as examples.
"""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
INDEX = ROOT / "frontend/public/steles/2-lishu/1-caoquanbei/chars_yang/index.json"
APP = ROOT / "frontend/public/data/stele_appreciations.json"
OUT = (
    ROOT / "frontend/public/steles/2-lishu/1-caoquanbei/chars_yang/point_evidence.json"
)


N_PER_POINT = 8


def main() -> None:
    raw = json.loads(INDEX.read_text(encoding="utf-8"))
    files = raw.get("files") or []

    by_char: dict[str, list[dict]] = defaultdict(list)
    for f in files:
        ch = str(f.get("char") or "").strip()
        if not ch:
            continue
        by_char[ch].append(f)

    for ch in list(by_char.keys()):
        by_char[ch].sort(key=lambda x: int(x.get("index")))

    freq = Counter({ch: len(v) for ch, v in by_char.items()})
    top_chars = [ch for ch, _ in freq.most_common(30)]

    app = json.loads(APP.read_text(encoding="utf-8"))
    items = app.get("items") or []
    cao = next((x for x in items if str(x.get("id")) == "li_001"), None)
    if not cao:
        raise SystemExit("missing li_001 in stele_appreciations.json")

    points = list(cao.get("points") or [])[:10]
    if not points:
        raise SystemExit("li_001 has no points")

    # Prefer common teaching chars if present.
    preferred = ["之", "不", "王", "年", "君", "其", "德", "孝", "郡", "曹"]
    pool = [ch for ch in preferred if ch in by_char]
    for ch in top_chars:
        if ch not in pool and ch in by_char:
            pool.append(ch)

    mapping: dict[str, dict] = {}
    for i, p in enumerate(points):
        ch = pool[i % len(pool)]
        occs = by_char.get(ch) or []
        glyph_ids = [int(x.get("index")) for x in occs[:N_PER_POINT]]
        mapping[str(i)] = {
            "tag": str(p.get("tag") or ""),
            "char": ch,
            "glyphIds": glyph_ids,
        }

    out = {
        "version": 1,
        "steleId": "li_001",
        "steleName": "曹全碑",
        "nPerPoint": N_PER_POINT,
        "points": mapping,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
