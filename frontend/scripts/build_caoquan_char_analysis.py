#!/usr/bin/env python3

"""Build offline similarity + clustering for Caoquanbei chars.

This generates `analysis.json` next to `index.json` under:
  frontend/public/steles/2-lishu/1-caoquanbei/chars_yang/

Design goals:
- Deterministic output (stable across runs)
- Light-weight features (24x24 normalized grayscale)
- Works offline (no ML dependencies)
"""

from __future__ import annotations

import json
import math
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
INDEX = ROOT / "frontend/public/steles/2-lishu/1-caoquanbei/chars_yang/index.json"
OUT = ROOT / "frontend/public/steles/2-lishu/1-caoquanbei/chars_yang/analysis.json"


SIZE = 24


def clamp(n: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, n))


def feature_for_png(path: Path) -> list[float]:
    im = Image.open(path).convert("RGB")
    im = im.resize((SIZE, SIZE), Image.Resampling.BILINEAR)
    # Pillow typing for getdata() is imprecise; we know it's (r,g,b) tuples.
    px = list(im.getdata())  # type: ignore[arg-type]
    v = []
    for r, g, b in px:  # type: ignore[misc]
        y = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0
        v.append(float(y))
    mean = sum(v) / len(v) if v else 0.0
    var = sum((x - mean) ** 2 for x in v) / len(v) if v else 1.0
    std = math.sqrt(var) or 1.0
    return [(x - mean) / std for x in v]


def dist(a: list[float], b: list[float]) -> float:
    n = min(len(a), len(b))
    s = 0.0
    for i in range(n):
        d = a[i] - b[i]
        s += d * d
    return math.sqrt(s)


@dataclass
class Occ:
    glyph_id: int
    file: str
    char: str


def kmeans(feats: list[list[float]], k: int) -> list[int]:
    n = len(feats)
    if n == 0:
        return []
    k = clamp(k, 2, 5)
    k = min(k, n)

    # deterministic init (evenly spaced)
    centroids = []
    for c in range(k):
        idx = int(math.floor((c * (n - 1)) / max(1, k - 1)))
        centroids.append(list(feats[idx]))

    assign = [0] * n
    for _ in range(10):
        # assign
        for i in range(n):
            best = 0
            best_d = float("inf")
            for c in range(k):
                d0 = dist(feats[i], centroids[c])
                if d0 < best_d:
                    best_d = d0
                    best = c
            assign[i] = best

        # recompute centroids
        sums = [[0.0] * len(feats[0]) for _ in range(k)]
        counts = [0] * k
        for i in range(n):
            c = assign[i]
            counts[c] += 1
            fi = feats[i]
            si = sums[c]
            for j in range(len(si)):
                si[j] += fi[j]
        for c in range(k):
            if counts[c] == 0:
                continue
            inv = 1.0 / counts[c]
            centroids[c] = [x * inv for x in sums[c]]

    return assign


def main() -> None:
    if not INDEX.exists():
        raise SystemExit(f"missing index.json: {INDEX}")
    raw = json.loads(INDEX.read_text(encoding="utf-8"))
    files = raw.get("files") or []

    occs_by_char: dict[str, list[Occ]] = defaultdict(list)
    for f in files:
        ch = str(f.get("char") or "").strip()
        if not ch:
            continue
        glyph_id = int(f.get("index"))
        file_name = str(f.get("file"))
        occs_by_char[ch].append(Occ(glyph_id=glyph_id, file=file_name, char=ch))

    # stable order
    for ch in list(occs_by_char.keys()):
        occs_by_char[ch].sort(key=lambda o: o.glyph_id)

    # compute features once
    feat_by_glyph: dict[int, list[float]] = {}
    base_dir = INDEX.parent
    for ch, occs in occs_by_char.items():
        for o in occs:
            if o.glyph_id in feat_by_glyph:
                continue
            p = base_dir / o.file
            if not p.exists():
                raise SystemExit(f"missing png: {p}")
            feat_by_glyph[o.glyph_id] = feature_for_png(p)

    by_char = {}
    for ch, occs in occs_by_char.items():
        m = len(occs)
        if m <= 1:
            continue

        glyph_ids = [o.glyph_id for o in occs]
        feats = [feat_by_glyph[g] for g in glyph_ids]

        # similarity orders per anchor glyph
        similar = {}
        for a_idx, a_gid in enumerate(glyph_ids):
            a_feat = feats[a_idx]
            dists = []
            for b_idx, b_gid in enumerate(glyph_ids):
                dists.append((b_gid, dist(a_feat, feats[b_idx])))
            dists.sort(key=lambda x: x[1])
            similar[str(a_gid)] = [gid for (gid, _d) in dists]

        # clusters
        k = clamp(int(round(math.sqrt(m / 2.0))), 2, 5)
        assign = kmeans(feats, k)
        groups = defaultdict(list)
        for i, c in enumerate(assign):
            groups[int(c)].append(glyph_ids[i])

        clusters = []
        for cid, members in groups.items():
            # representative = closest to centroid (computed from member mean)
            # approximate by choosing medoid using pairwise distance sum
            best_gid = members[0]
            best_sum = float("inf")
            for gid in members:
                s = 0.0
                fg = feat_by_glyph[gid]
                for other in members:
                    s += dist(fg, feat_by_glyph[other])
                if s < best_sum:
                    best_sum = s
                    best_gid = gid
            clusters.append({"id": int(cid), "members": members, "rep": int(best_gid)})

        clusters.sort(key=lambda g: (-len(g["members"]), g["rep"]))

        by_char[ch] = {
            "count": m,
            "glyphIds": glyph_ids,
            "similar": similar,
            "clusters": clusters,
        }

    out = {
        "name": raw.get("name") or "",
        "version": 1,
        "feature": {"size": SIZE, "kind": "24x24_gray_zscore"},
        "by_char": by_char,
    }

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {OUT} chars={len(by_char)}")


if __name__ == "__main__":
    main()
