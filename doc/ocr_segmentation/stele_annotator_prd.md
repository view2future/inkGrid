# Stele Annotator (Web) - Product & Tech Plan

Goal: build a web-based annotation tool for calligraphy stele/rubbing datasets.

It uses AI to auto-segment + label, then a human provides fast "last-mile" fixes.
The output is a reproducible dataset that InkGrid can consume.

See also:
- `doc/ocr_segmentation/mozhen_gongfang_workbench.md` (InkGrid Workbench / 墨阵·工坊: end-to-end upload → auto-annotate → review → export)

## Non-goals (V1)

- Multi-user collaboration, permissions, locking
- Cloud hosting, remote object storage
- Interactive model training

Single-user local workflow is prioritized.

## Default Policy

- Prefer **not clipped** over **not noisy**.
- Allow small neighbor-column noise.
- Horizontal expansion is allowed up to the **midline** between adjacent columns.
- QA runs in **strict** mode and surfaces candidates early.

## User Workflow

1) Select stele + dataset version
- Source pages live under `steles/<path>/`
- A dataset version lives under `steles/<path>/<dataset_dir>/`

2) AI auto-run (outside V1 UI)
- Run extraction script to create a dataset (PNG + index.json)
- Run QA to create `qa_report.json` and `qa_summary.md`

3) QA queue
- Sort by score
- Filter by flags (`clipped_*`, `off_center`, `regression_case`)

4) Single-char fix (primary correction mode)
- Edit `crop_box` in page coordinates
- Quick buttons: expand top/bottom/left/right (x clamped to safe midline)
- Save override into `steles/<path>/annotator/overrides.json`
- Apply override to regenerate only the affected PNG(s)

5) Export
- Dataset directory is already in InkGrid-compatible format:
  `steles/<path>/<dataset_dir>/`

## Data Model

### index.json (dataset)

Existing dataset schema is extended with:
- `safe_column_box`: [x0, y0, x1, y1]

### overrides.json (per stele)

Location: `steles/<path>/annotator/overrides.json`

```json
{
  "version": 1,
  "crop_overrides": {
    "<file.png>": {
      "crop_box": [0, 0, 10, 10],
      "note": "optional"
    }
  }
}
```

### QA outputs (per dataset)

- `qa_report.json` (machine readable)
- `qa_summary.md` (top suspicious list)

Key metrics:
- `outer_ring_contact_*` directional contact ink (clipped evidence)
- `center_dx/dy` (off-center)

## API (V1)

Backend: `backend/app/main.py`

- `GET /api/annotator/overrides/{stele_path}`
- `POST /api/annotator/overrides/{stele_path}`
- `GET /api/annotator/datasets/{stele_path}`
- `POST /api/annotator/apply/{stele_path}`
  - body: `{ "dataset_dir": "chars_shenlong_v19", "only_files": ["..."], "run_qa": true }`

## Frontend (V1)

Entry:

- Open InkGrid with:

  `/?mode=annotator&stele=4-xingshu/1-lantingjixu&dataset=chars_shenlong_v21`

Component:

- `frontend/src/components/SteleAnnotator.tsx`
  - Loads `qa_report.json` from `/steles/<stele>/<dataset>/qa_report.json`
  - Saves overrides via API
  - Applies overrides via API

## Milestones

M1: QA queue + single-char crop editing + overrides save/apply

M2: Add per-char "recenter" and keyboard shortcuts

M3: Add per-page overlay view (columns + char boxes)

M4: Add configurable pipeline runner (choose extraction script + params)
