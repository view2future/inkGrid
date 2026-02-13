# Implementation Plan - Track: vlm_processor_refactor

## Phase 1: Foundation & VLM Setup (墨核 · 重塑) [COMPLETED]
- [x] Task: Update dependencies for Gemini SDK.
    - [x] Add `google-generativeai` and `pydantic` to `processor/requirements.txt`.
- [x] Task: Initialize VLM Client Module ("InkCloud").
    - [x] Create/Refactor `processor/core/vlm_client.py` with `GeminiSDKClient`.
    - [x] Write test script `processor/tests/test_vlm_connection.py`.

## Phase 2: Prompt Engineering & Data Modeling (提示 · 灵动) [COMPLETED]
- [x] Task: Design Calligraphy Specialized Prompt.
    - [x] Refine `processor/core/prompts.py`.
- [x] Task: Implement Coordinate Transformation & Pydantic Models.
    - [x] Define models in `processor/core/models.py`.
- [x] Task: Implement Mock/Real VLM Inference Logic.
    - [x] Refactor `processor/core/inference.py` to support multi-provider.

## Phase 3: Asynchronous Workflow & API Refactoring (连珠 · 异步) [COMPLETED]
- [x] Task: Update Celery Tasks for VLM Workflow.
    - [x] Refactor `processor/celery_app.py` to pass `provider` param.
- [x] Task: Refactor FastAPI Endpoints.
    - [x] Update `processor/main.py` with provider selection.

## Phase 4: Verification & Final Integration (墨阵 · 大成) [IN PROGRESS]
- [ ] Task: Comprehensive Accuracy Testing.
- [ ] Task: Performance & Cost Audit.
- [ ] Task: Final Documentation & Cleanup.
    - [x] Basic README update.