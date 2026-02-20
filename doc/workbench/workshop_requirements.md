#+#+#+#+------------------------------------------------------------
InkGrid Workshop / 墨阵·工坊
Requirements + Worklist (keep-context doc)
------------------------------------------------------------

This document records the Workbench/Workshop requirements and the
engineering worklist, so work can continue even if chat context is lost.

Last updated: 2026-02-19

## 0. Product North Star

The most important capability of `墨阵·工坊` is:

"Draw lines / build a grid on stele pages, so characters can be cropped
precisely for annotation and dataset export".

The Page Editor experience should reach world-class, professional tool
standards (design-tool level): fast, precise, undoable, and predictable.

## 1. Entry URL

Preferred entry:

- `http://localhost:5173/workshop`

Compatibility (keep existing behavior):

- `http://localhost:5173/?mode=workbench`

Notes:

- This is a SPA route. Static hosting must be configured to fallback
  unknown paths to `index.html`.

## 2. Target UX (confirmed decisions)

Confirmed decisions from the latest iteration:

- Visual direction: `1A` (minimal, modern tool; Linear/Figma-like).
- Primary input: trackpad.
- Editor gestures:
  - Two-finger scroll => pan canvas.
  - Pinch (usually wheel + ctrlKey) => zoom with cursor anchor.
  - Space + drag => pan (fallback).
- Page Editor: full-screen immersive mode is required.
- Font: introduce a modern sans-serif for Workbench UI.
- Preview trigger: `Q1-A` (recommended)
  - Drag updates locally (instant).
  - Backend preview is debounce or manual (controllable).
- Grid freedom: `ragged grid` is required.
  - "自由数量": each column/row may have different cell counts.
  - "auto inference" is the primary way to decide per-lane counts.
- Directions: both `vertical_rtl` and `horizontal_ltr` must have a
  consistent professional experience.

## 3. Current Implementation (quick map)

- Frontend Workbench UI:
  - `frontend/src/components/Workbench.tsx`
  - Page Editor is currently implemented inside Workbench as a modal.
- Backend Workbench API:
  - `backend/app/main.py`
  - `backend/app/services/workbench_service.py`
- Preview recompute script:
  - `scripts/workbench_preview_page.py`
- Dataset build/export:
  - `scripts/workbench_build_dataset.py`

## 4. Problems to solve (user-facing)

1) Page layout editing feels like operating an instrument; not intuitive.
2) UI/UX is rigid; not modern; lacks product-level interaction.
3) Styling is not unified; should use Tailwind systematically.

## 5. Professional Page Editor: Must-have features

### 5.1 Viewport & Input

- 60fps pan/zoom.
- Trackpad pan by default (two-finger scroll).
- Pinch zoom anchored to cursor (no drift).
- Keyboard shortcuts: 0 (fit), 1 (100%), +/- (zoom), Esc (exit), Tab
  (toggle inspector), Cmd/Ctrl+Z (undo), Cmd/Ctrl+Shift+Z (redo).

### 5.2 Editing Model

- Editing should be "cell-first", not "line-first":
  - Show a subtle cell fill overlay.
  - Show clear draggable handles.
  - Hover/selection highlights lane and cell.

### 5.3 Ragged Grid (自由数量)

Support per-lane variable cell counts:

- vertical_rtl:
  - `col_bounds: number[]`
  - `row_bounds_by_col: number[][]` (length varies per column)
- horizontal_ltr:
  - `row_bounds: number[]`
  - `col_bounds_by_row: number[][]` (length varies per row)

### 5.4 Safety & Professional Control

- Undo/Redo for every drag end.
- Nudge selected boundary with arrow keys (1px; shift=5px).
- Snap-to-guides with modifier keys:
  - default snap on
  - Alt disables snap temporarily
  - Shift forces snap/alignment

### 5.5 Quality Feedback (cropping loop)

- Hover a cell => show crop preview tooltip.
- Inspector shows lane thumbnails to spot cross-cell swallowing.
- Lightweight QA marking (heuristics allowed initially).

## 6. Backend Preview Strategy (Q1-A)

Design principle:

- Frontend changes layout instantly.
- Backend preview is used for:
  - overlays
  - cells.json
  - candidate guides for snapping
  - (optional) thumbnails/QA

Required change:

- `preview_page` job must accept a draft layout and should NOT
  automatically persist into `pages.json`.
- Persistence should be explicit (Apply).

Proposed API extension:

- `POST /api/workbench/projects/{stele}/jobs`
  - `{ type: 'preview_page', page: 'xxx.jpg', layout?: object, persist?: boolean }`

## 7. Worklist (phased delivery)

### Phase 1 - Editor shell + gestures + draft mode

- Extract Page Editor out of `Workbench.tsx`.
- Implement full-screen editor with collapsible inspector.
- Implement trackpad pan + pinch zoom w/ cursor anchor.
- Add draft layout state + dirty indicator.
- Change preview triggering to debounce/manual.

Acceptance:
- No blocking network roundtrip during drag.
- Fit/100% works; Esc closes; Tab collapses inspector.

### Phase 1.5 - Preview accepts draft layout (no forced persistence)

- Extend backend preview job to accept `layout` input.
- Add `persist` flag (default false).
- Update `scripts/workbench_preview_page.py`:
  - consume provided layout
  - only write pages.json when persist=true

Acceptance:
- Preview matches draft layout.
- Without Apply, project files remain unchanged.

### Phase 2 - Ragged grid end-to-end

- Update preview to output ragged layout (variable counts per lane).
- Update dataset export to iterate by boundary arrays, not fixed rows/cols.
  - `scripts/workbench_build_dataset.py`
- Update cells/expected-cells calculation to use layout when present.
  - backend `_compute_total_cells` + frontend display.

Acceptance:
- Tail/inscription columns with fewer cells export correctly.
- Text length mismatch becomes reliable.

### Phase 3 - Professional editing controls

- Undo/Redo.
- Snap-to-guides.
- Nudge + modifiers.
- Lane batch ops:
  - apply lane to all
  - smooth across lanes
  - reset lane

Acceptance:
- One-drag-to-correct becomes common.
- Mistakes are reversible instantly.

### Phase 4 - Cropping quality loop

- cell hover crop preview.
- lane thumbnail strip.
- basic QA heatmap.

Acceptance:
- Layout tuning decisions are driven by crop results.

### Phase 5 - Visual system (1A)

- Tailwind UI primitives: Button/Card/Badge/Kbd/Tooltip/Toast.
- Introduce Workbench font.
- Use standard cursor inside Workbench/editor.
- Reduce rigid borders; improve hierarchy; keep accents minimal.

Acceptance:
- Workbench looks and feels like a modern professional tool.

## 8. Related doc

- `doc/ocr_segmentation/mozhen_gongfang_workbench.md`
