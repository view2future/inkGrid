# Stele Character Cropping Skill (Reusable)

This document captures a reusable process ("skill") for extracting single-character
images from stele/rubbing page scans.

The goal is to make future stele processing fast and accurate by:
- Recording failure modes (taxonomy)
- Defining strict QA metrics
- Providing auto-fix strategies and manual override hooks
- Maintaining a regression set of known-bad cases

## Default Policy

- Prefer **not clipped** over **not noisy**.
- Allow small neighbor-column noise if it avoids clipping.
- Horizontal expansion is allowed up to the **midline** between adjacent columns.
- Vertical expansion must be clamped within the **midline** between adjacent cells
  (safe row corridor) to prevent cross-cell swallow.
- QA runs in **strict** mode by default: surface candidates early.

## Failure Mode Taxonomy

- `missing`: crop is mostly blank, or ink is extremely low.
- `clipped`: ink continues outside crop boundaries; stroke tails are cut.
- `off_center`: ink mass is not centered in output square.
- `multi_glyph`: multiple characters appear in one crop.
- `cross_cell_swallow`: crop overlaps adjacent cells heavily; different labels may
  produce near-identical outputs (mislabel risk).
- `seal_occlusion`: red seals / dark occlusions dominate segmentation.
- `faint_ink`: faint strokes are removed by thresholding.

## Pipeline Modules

1) Layout / column detection
- Detect columns via x-projection.
- Output both `column_box` and `safe_corridor` boundaries (midlines between columns).

Row safe corridor (equally important):
- After splitting a column into N cells, compute per-cell safe y-bounds by the
  midline between adjacent cells.
- Clamp any context expansion / contact-based expansion within that safe row range.

Practical note for cursive rubbings:
- Some stroke tails genuinely cross cell midlines. If you clamp too hard, you will
  get `clipped_bottom/top` even when the split is correct. A safe approach is:
  keep a small safe-row bleed margin (proportional to cell height), and rely on QA
  `overlap_adjacent_cells` to surface cases where the crop is swallowing neighbors.

2) Constrained split (per column)
- Use transcript constraints: each column must yield N characters.
- Prefer DP / constrained search with deviation penalty over greedy valley snapping.
- Add a per-cell height penalty in DP transitions to reduce "first/last cell collapse".
- Enforce `min_cell_height` to prevent tail collapse.

3) Crop refinement (per character)
- Start with a context crop (may expand within safe corridor).
- Compute ink bbox using strict + loose masks.
- Retry with larger context/padding if any clipped evidence is detected.
- Final safety pass: expand the resulting `crop_box` by directional contact ink
  (clamped to safe midlines) to preserve stroke tails.

4) Normalize output
- Center by the main ink component (not by raw image center).
- Resize to target square with an inner padding.

## Strict QA Metrics

The key clipped signal should be **outer ring ink**, not only edge-touch.

In practice, "any ring ink" can be too sensitive (paper texture, neighbor noise).
Use **contact ring ink** as the primary clipped signal: ring ink that touches the
inner ink region.

For actionable fixes, record **directional contact** (left/right/top/bottom).
This enables auto-fix suggestions like "expand_left" / "expand_bottom".

- `outer_ring_contact_ink`: ink pixels in the ring that touch inner ink.
  - If above threshold, it strongly suggests clipping.
- `outer_ring_ink`: total ink pixels in the ring (useful as context).
- `edge_touch_loose`: whether loose ink touches crop edges.
- `center_offset(dx,dy)`: ink centroid offset from output canvas center.
- `cc_count`: connected component count in output or crop.

Practical note:
- `edge_touch_loose` is a very sensitive signal (many well-cropped glyphs naturally
  touch edges after normalization). Use it as a *secondary* flag, typically gated
  by outside-ink evidence (e.g. `outer_ring_contact_ink` or large `outer_ring_ink`).

Centering note:
- When normalizing output, selecting the **dominant ink component** (by size) is
  usually more robust than over-weighting an expected center. This reduces
  off-center failures caused by small near-center speckles or neighbor noise.

Outputs:
- `qa_report.json` (machine-readable)
- `qa_summary.md` (human-friendly top suspicious list)

## Regression

Store known-problematic file names in `regression_cases.json` next to the source
images. QA tools should highlight these cases and compare their metrics across
algorithm versions.

## Tools

- `scripts/qa_char_crops.py`: dataset QA (strict by default)
- `scripts/apply_crop_overrides.py`: apply manual crop_box overrides

## Annotator Workflow

For web-based last-mile fixes, store overrides at:

- `steles/<stele>/annotator/overrides.json`

Apply overrides to a generated dataset:

```bash
python3 scripts/apply_crop_overrides.py \
  --dataset-dir steles/<stele>/<dataset_dir> \
  --source-dir steles/<stele> \
  --overrides steles/<stele>/annotator/overrides.json
```

Example usage:

```bash
python3 scripts/qa_char_crops.py \
  --dataset-dir steles/4-xingshu/1-lantingjixu/chars_shenlong_v7 \
  --source-dir steles/4-xingshu/1-lantingjixu
```
