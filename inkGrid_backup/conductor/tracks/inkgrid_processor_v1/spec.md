# Track Specification: Upgrade InkGrid-Processor with PaddleOCR (v2.0)

## 1. Overview
This track focuses on a major architectural upgrade for the `inkGrid-Processor` microservice. We are replacing the rule-based OpenCV segmentation algorithm with a deep learning-based approach using **PaddleOCR**. The goal is to achieve near-perfect character segmentation accuracy (e.g., exactly 135 characters for *Yishan Stele*) by leveraging PaddleOCR's detection capabilities, while using its recognition outputs to assist in sequence alignment.

## 2. Goals
*   **Segmentation Accuracy:** Achieve 98%+ accuracy in character bounding box detection, specifically resolving "under-segmentation" (fused characters) and "over-segmentation" (split strokes) issues in Lishu and Zhuanshu.
*   **Robustness:** Handle noise (rubbing artifacts) and complex layouts (tight spacing) better than projection methods.
*   **Smart Alignment:** Implement a content-aware alignment algorithm that uses OCR recognition results as "anchors" to robustly map bounding boxes to ground truth text.

## 3. Functional Requirements

### 3.1 Environment & Dependencies
*   **PaddlePaddle Integration:** Add `paddlepaddle` (CPU default, GPU optional) and `paddleocr` to `processor/requirements.txt`.
*   **Model Management:** Implement a **Runtime Volume** strategy. The service should check for models in a mounted `/root/.paddleocr` directory and download them only if missing.

### 3.2 Core Logic Refactoring
*   **Segmentation Engine (`segmentation.py`):**
    *   Replace OpenCV projection logic with `PaddleOCR` class initialization and inference.
    *   Configure critical parameters: `det_db_thresh`, `det_db_box_thresh`, `det_db_unclip_ratio` to optimize for stele rubbings.
    *   Output not just BBoxes, but also OCR Text and Confidence.
*   **Alignment Engine (`alignment.py`):**
    *   Upgrade from simple 1-to-1 sequence mapping to **Content-Aware Alignment**.
    *   Use OCR text to anchor the alignment with the Ground Truth text (e.g., if OCR sees "王" and GT has "王", lock that pair).
    *   Handling mismatches: Use OCR confidence and sequence constraints to resolve insertions/deletions.

### 3.3 Data Handling
*   **Output Format:** Enhanced JSON structure including:
    ```json
    {
      "char": "皇",       // From Ground Truth
      "bbox": [x, y, w, h],
      "ocr_text": "皇",   // From PaddleOCR (metadata)
      "ocr_conf": 0.95,   // From PaddleOCR (metadata)
      "is_fallback": false // True if GT was missing and OCR was used
    }
    ```

## 4. Non-Functional Requirements
*   **Performance:** PaddleOCR is heavier than OpenCV. Ensure inference time is acceptable (< 10s per page on CPU).
*   **Docker Image:** Keep the Docker image size reasonable by NOT baking models into the image.

## 5. Acceptance Criteria
*   [ ] `processor` service runs with PaddleOCR installed and working.
*   [ ] **Yishan Stele Test:** Processing `yishan.jpg` yields exactly or very close to **135 bounding boxes**.
*   [ ] **Caoquan Stele Test:** Processing `caoquanbei-001.jpg` correctly separates adjacent Lishu characters (no "4 chars in 1 box").
*   [ ] Alignment logic successfully maps boxes to the standard text, using OCR results to correct shifts if possible.
*   [ ] Noise (like stone flowers) is largely ignored by the detection model.