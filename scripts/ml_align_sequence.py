#!/usr/bin/env python3

"""Align an ordered detection sequence to a gold text string.

This is a lightweight DP aligner intended for the "full-text order + char labels"
pipeline stage.

It does NOT perform character recognition. Instead, it assumes you already sorted
detections in reading order (layout stage) and wants to map them onto a known
transcription string.

Supported operations:

- match1: one detection -> one char
- match2: one detection -> two chars (allowed for merged boxes)
- skip_det: ignore a detection (seal/noise)
- skip_char: missing char

Input JSON format (detections-json):

{ "detections": [ { "id": "...", "score": 0.9 }, ... ] }

Output:

{ "aligned": [ { "id": "...", "text": "字" or "两个", "text_index": i }, ... ] }
"""

from __future__ import annotations

import argparse
import json
import math
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Step:
    op: str
    i: int
    j: int
    take: int


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--text", required=True, help="Gold transcription (no spaces)")
    ap.add_argument("--detections-json", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--skip-det-pen", type=float, default=1.2)
    ap.add_argument("--skip-char-pen", type=float, default=1.0)
    ap.add_argument("--match2-pen", type=float, default=0.45)
    ap.add_argument("--pred-json", default=None, help="Classifier predictions JSON")
    ap.add_argument("--cls-topk", type=int, default=5)
    ap.add_argument("--cls-miss-pen", type=float, default=1.4)
    ap.add_argument("--cls-weight", type=float, default=0.7)
    args = ap.parse_args()

    text = str(args.text).strip()
    det_path = Path(args.detections_json)
    data = json.loads(det_path.read_text(encoding="utf-8"))
    dets = data.get("detections")
    if not isinstance(dets, list):
        raise SystemExit("detections-json must contain {detections:[...]} ")

    ids: list[str] = []
    scores: list[float] = []
    for d in dets:
        if not isinstance(d, dict):
            continue
        ids.append(str(d.get("id") or ""))
        s = float(d.get("score") or 0.0)
        scores.append(max(1e-6, min(1.0, s)))
    n = len(ids)
    m = len(text)

    preds: dict[str, list[tuple[str, float]]] = {}
    if args.pred_json:
        p = Path(args.pred_json)
        if not p.exists():
            raise SystemExit(f"Missing pred-json: {p}")
        pj = json.loads(p.read_text(encoding="utf-8"))
        raw = pj.get("preds")
        if isinstance(raw, dict):
            for k, v in raw.items():
                if not isinstance(v, list):
                    continue
                out: list[tuple[str, float]] = []
                for it in v[: max(0, int(args.cls_topk))]:
                    if not isinstance(it, dict):
                        continue
                    ch = str(it.get("char") or it.get("text") or "").strip()
                    if not ch:
                        continue
                    try:
                        prob = float(it.get("p") or it.get("prob") or 0.0)
                    except Exception:
                        prob = 0.0
                    if prob <= 0.0:
                        continue
                    out.append((ch, prob))
                if out:
                    preds[str(k)] = out

    # DP: dp[i][j] best (min) cost for first i dets aligned to first j chars.
    INF = 1e18
    dp = [[INF] * (m + 1) for _ in range(n + 1)]
    prev: list[list[Step | None]] = [[None] * (m + 1) for _ in range(n + 1)]
    dp[0][0] = 0.0

    skip_det_pen = float(args.skip_det_pen)
    skip_char_pen = float(args.skip_char_pen)
    match2_pen = float(args.match2_pen)
    cls_miss_pen = float(args.cls_miss_pen)
    cls_weight = float(args.cls_weight)

    def match_cost(i: int) -> float:
        # Prefer high-score detections.
        return -math.log(scores[i])

    def cls_penalty(det_id: str, gold: str) -> float:
        if not preds:
            return 0.0
        cand = preds.get(det_id)
        if not cand:
            return 0.0
        for ch, p in cand:
            if ch == gold:
                # Lower penalty when classifier is confident.
                return cls_weight * (-math.log(max(1e-6, min(1.0, float(p)))))
        return cls_miss_pen

    for i in range(n + 1):
        for j in range(m + 1):
            cur = dp[i][j]
            if cur >= INF:
                continue
            # skip detection
            if i < n:
                # skipping a high-confidence det should cost more
                v = cur + skip_det_pen + 0.25 * match_cost(i)
                if v < dp[i + 1][j]:
                    dp[i + 1][j] = v
                    prev[i + 1][j] = Step("skip_det", i, j, 0)

            # skip char (missing)
            if j < m:
                v = cur + skip_char_pen
                if v < dp[i][j + 1]:
                    dp[i][j + 1] = v
                    prev[i][j + 1] = Step("skip_char", i, j, 0)

            # match 1
            if i < n and j < m:
                v = cur + match_cost(i) + cls_penalty(ids[i], text[j])
                if v < dp[i + 1][j + 1]:
                    dp[i + 1][j + 1] = v
                    prev[i + 1][j + 1] = Step("match1", i, j, 1)

            # match 2 (merged bbox)
            if i < n and j + 1 < m:
                v = (
                    cur
                    + match_cost(i)
                    + match2_pen
                    + cls_penalty(ids[i], text[j])
                    + cls_penalty(ids[i], text[j + 1])
                )
                if v < dp[i + 1][j + 2]:
                    dp[i + 1][j + 2] = v
                    prev[i + 1][j + 2] = Step("match2", i, j, 2)

    # Pick best end state: allow some trailing skips.
    best_j = min(range(m + 1), key=lambda jj: dp[n][jj])
    i, j = n, best_j
    steps: list[Step] = []
    while i > 0 or j > 0:
        st = prev[i][j]
        if st is None:
            break
        steps.append(st)
        if st.op == "skip_det":
            i = st.i
            j = st.j
        elif st.op == "skip_char":
            i = st.i
            j = st.j
        else:
            i = st.i
            j = st.j
    steps.reverse()

    aligned: list[dict] = []
    ti = 0
    di = 0
    for st in steps:
        if st.op == "skip_det":
            di += 1
            continue
        if st.op == "skip_char":
            ti += 1
            continue
        if st.op == "match1":
            ch = text[ti]
            aligned.append({"id": ids[di], "text": ch, "text_index": ti, "take": 1, "score": scores[di]})
            di += 1
            ti += 1
            continue
        if st.op == "match2":
            ch2 = text[ti : ti + 2]
            aligned.append({"id": ids[di], "text": ch2, "text_index": ti, "take": 2, "score": scores[di]})
            di += 1
            ti += 2
            continue

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out = {
        "text_len": len(text),
        "det_len": n,
        "aligned_len": len(aligned),
        "best_end_text_index": best_j,
        "cost": dp[n][best_j],
        "aligned": aligned,
    }
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"done aligned={len(aligned)} out={out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
