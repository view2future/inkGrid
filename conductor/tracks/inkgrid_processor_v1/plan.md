# Implementation Plan - Track: inkgrid_processor_v1 (PaddleOCR Upgrade)

## Phase 1: Environment & Dependencies (墨核 · 升级)
- [ ] Task: Update dependencies.
    - [ ] Add `paddlepaddle` and `paddleocr` to `processor/requirements.txt`.
    - [ ] Rebuild Docker image to include new dependencies.
- [ ] Task: Configure Model Management.
    - [ ] Update `docker-compose.yml` to mount a volume for model persistence (e.g., `./models:/root/.paddleocr`).
    - [ ] Verify PaddleOCR installation and model download on first run.
- [ ] Task: Conductor - User Manual Verification 'Environment & Dependencies' (Protocol in workflow.md)

## Phase 2: PaddleOCR Integration (界格 · 慧眼)
- [ ] Task: Refactor `processor/core/segmentation.py`.
    - [ ] Initialize `PaddleOCR` instance (use_angle_cls=False, lang="ch").
    - [ ] Implement `segment_image` using `ocr.ocr(img, cls=False)`.
    - [ ] Extract BBoxes, Text, and Confidence from the result.
    - [ ] Implement sorting logic (Right-to-Left, Top-to-Bottom) for the detected boxes.
- [ ] Task: Parameter Tuning & Verification.
    - [ ] Create `test_paddle_segmentation.py` to visualize results.
    - [ ] Tune `det_db_thresh` and `det_db_box_thresh` to optimize for `yishan.jpg` (Goal: ~135 boxes).
    - [ ] Verify `caoquanbei-001.jpg` to ensure no "fused" characters.
- [ ] Task: Conductor - User Manual Verification 'PaddleOCR Integration' (Protocol in workflow.md)

## Phase 3: Content-Aware Alignment (连珠 · 智合)
- [ ] Task: Upgrade `processor/core/alignment.py`.
    - [ ] Implement "Anchor-based Alignment" logic.
    - [ ] If OCR text matches Ground Truth char (fuzzy match), lock alignment.
    - [ ] Handle gaps/mismatches between anchors using sequence interpolation.
- [ ] Task: Update Output Format.
    - [ ] Ensure final JSON includes `ocr_text` and `ocr_conf` metadata.
- [ ] Task: Conductor - User Manual Verification 'Content-Aware Alignment' (Protocol in workflow.md)

## Phase 4: Integration & Final Polish (墨阵 · 圆满)
- [ ] Task: Update Celery Task.
    - [ ] Ensure `process_stele` task uses the new segmentation and alignment functions.
- [ ] Task: Full Pipeline Test.
    - [ ] Run `test_integration.py` on `yishan.jpg` and check the final alignment JSON.
- [ ] Task: Conductor - User Manual Verification 'Integration & Final Polish' (Protocol in workflow.md)