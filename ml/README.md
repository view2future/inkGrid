# InkGrid ML: stele page -> character crops

This directory documents and scaffolds the training pipeline for a model that:

1) reads stele page images (calligraphy rubbings / scans)
2) detects / segments single-glyph regions
3) outputs per-glyph crops with stable naming + `index.json` metadata

Design goals (based on past crop failures):

- Prefer *not clipped* over *not noisy* (a little neighbor ink is acceptable)
- Work across scripts (zhuan/li/kai + a few classic xingshu)
- Support full-text order + per-glyph char labels (alignment)
- Provide QA + regression loops to keep improving

## Current repo assets you should reuse

- Existing datasets: `steles/**/chars_*/index.json` (per glyph `source.crop_box`)
- Workbench layout overrides: `steles/**/workbench/pages.json`
- Crop QA: `scripts/qa_char_crops.py`

## Phase 0: export a YOLO detection dataset (silver labels)

This uses existing `index.json` crop boxes as bbox annotations on the *full page images*.

```bash
python3 scripts/ml_build_yolo_dataset.py \
  --dataset-dir "steles/3-kaishu/4-qianhouchibifu/chars_body_v13" \
  --dataset-dir "steles/3-kaishu/3-nikuanzan/chars_nikuanzan_final" \
  --out-dir "ml/datasets/yolo_det_v1" \
  --val-ratio 0.12 \
  --seed 42
```

Outputs:

- `ml/datasets/yolo_det_v1/images/{train,val}/...`
- `ml/datasets/yolo_det_v1/labels/{train,val}/...` (YOLO txt)
- `ml/datasets/yolo_det_v1/inkgrid.yaml` (Ultralytics dataset file)
- `ml/datasets/yolo_det_v1/meta/pages.json` / `meta/annotations.jsonl`

Notes:

- The exporter expands bboxes slightly (to reduce clipping) and clamps to safe boxes when present.
- Images are hardlinked/symlinked by default to avoid duplicating large pages.

## Phase 1: train a bbox detector locally (Mac M3)

Ultralytics is not vendored in this repo. Install into your local venv:

```bash
python3 -m pip install -U ultralytics
```

Then train:

```bash
yolo detect train \
  data=ml/datasets/yolo_det_v1/inkgrid.yaml \
  model=yolo11n.pt \
  imgsz=1280 \
  batch=8 \
  epochs=80 \
  device=mps
```

## Phase 2: QA + active learning (200 gold boxes/week)

1) Run inference on held-out pages.
2) Convert predictions into crops.
3) Run QA (`scripts/qa_char_crops.py`) and pick the worst offenders.
4) Fix those 200 in workbench / bbox editor.
5) Re-train.

The key is to keep a *fixed regression set* across scripts and page qualities.

Suggested weekly loop (200 samples):

```bash
python3 scripts/qa_char_crops.py \
  --dataset-dir steles/3-kaishu/4-qianhouchibifu/chars_body_v13 \
  --source-dir steles/3-kaishu/4-qianhouchibifu

python3 scripts/ml_pick_gold_candidates.py \
  --qa-report steles/3-kaishu/4-qianhouchibifu/chars_body_v13/qa_report.json \
  --out ml/exports/gold_candidates_chibi.csv \
  --top 200
```

## Alignment (full-text labels)

For datasets where you have the full text string (gold transcription), you can align
the ordered glyph sequence to the text allowing missing glyphs and merged boxes.

Tooling scaffold:

```bash
python3 scripts/ml_align_sequence.py --text "...全文..." --detections-json det.json --out aligned.json
```

This is intentionally simple (DP alignment) and meant to be extended later with a recognizer.

### Optional: train a lightweight per-stele character classifier

This helps alignment when geometry-only ordering drifts (seals / blanks / merged boxes).

1) Export a classification dataset from an existing chars dataset:

```bash
python3 scripts/ml_build_char_classifier_dataset.py \
  --dataset-dir steles/3-kaishu/3-nikuanzan/chars_nikuanzan_final \
  --out-dir ml/datasets/cls_nikuanzan_v1
```

2) Train with Ultralytics (after install):

```bash
yolo classify train \
  data=ml/datasets/cls_nikuanzan_v1 \
  model=yolo11n-cls.pt \
  imgsz=224 \
  batch=64 \
  epochs=50 \
  device=mps
```

## Phase 3: use detector to refine crops (cell-guided)

Once you have a detector, you can *keep* the grid-based reading order and text
labels, but use the detector to choose a better crop box inside each cell.

1) Predict detections on pages:

```bash
python3 scripts/ml_yolo_predict_pages.py \
  --model runs/detect/train/weights/best.pt \
  --pages-dir steles/3-kaishu/4-qianhouchibifu \
  --glob 'qianhouchibifu-*.webp' \
  --out ml/exports/chibi_dets.json
```

2) Build a new dataset using those detections:

```bash
python3 scripts/ml_refine_crops_with_detector.py \
  --stele-slug kai_021 \
  --stele-dir steles/3-kaishu/4-qianhouchibifu \
  --detections-json ml/exports/chibi_dets.json \
  --out-dir steles/3-kaishu/4-qianhouchibifu/chars_body_v14_ml \
  --direction vertical_rtl --cols 5 --rows 7 \
  --alignment-text steles/3-kaishu/4-qianhouchibifu/chars_body_v13/text.txt \
  --run-qa
```

This produces `index.json` + per-char `.webp`, and runs crop QA automatically.

### Full pipeline (det -> sequence -> align -> split -> dataset)

This is the path that supports:

- layout-based reading order
- classifier-assisted full-text alignment
- merged-box split (`take=2`)

```bash
python3 scripts/ml_build_detection_sequence.py \
  --stele-dir steles/3-kaishu/3-nikuanzan \
  --detections-json ml/exports/nikuanzan_dets.json \
  --out ml/exports/nikuanzan_seq.json \
  --direction vertical_rtl --cols 5 --rows 7

python3 scripts/ml_align_sequence.py \
  --text "$(cat steles/3-kaishu/3-nikuanzan/chars_nikuanzan_final/text.txt)" \
  --detections-json ml/exports/nikuanzan_seq.json \
  --out ml/exports/nikuanzan_aligned.json

python3 scripts/ml_split_and_build_dataset.py \
  --stele-dir steles/3-kaishu/3-nikuanzan \
  --stele-slug nikuanzan \
  --detections-seq ml/exports/nikuanzan_seq.json \
  --alignment-json ml/exports/nikuanzan_aligned.json \
  --out-dir steles/3-kaishu/3-nikuanzan/chars_nikuanzan_from_det \
  --direction vertical_rtl
```

### Smoke test without a trained model

You can export detections from an existing dataset (upper bound / perfect detector):

```bash
python3 scripts/ml_export_dets_from_index.py \
  --dataset-dir steles/3-kaishu/4-qianhouchibifu/chars_body_v13 \
  --out ml/exports/chibi_dets_perfect.json
```

Then run the refine pipeline with that detections file.
