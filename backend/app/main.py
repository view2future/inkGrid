import os
import subprocess
from fastapi import Depends, FastAPI, Header, HTTPException, UploadFile, File
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.services.alignment_service import AlignmentService
from app.services.catalog_service import CatalogService
from app.services.annotator_service import AnnotatorService
from app.services.workbench_service import WorkbenchService
from app.health import router as health_router

app = FastAPI(title="墨阵 InkGrid API")
app.include_router(health_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

alignment_service = AlignmentService()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend", "dist")
PUBLIC_DIR = os.path.join(BASE_DIR, "public")
STELES_DIR = os.path.join(BASE_DIR, "steles")

catalog_service = CatalogService(BASE_DIR, FRONTEND_DIR)
annotator_service = AnnotatorService(BASE_DIR, STELES_DIR)
workbench_service = WorkbenchService(BASE_DIR, STELES_DIR)


def require_admin(x_inkgrid_admin_token: str | None = Header(default=None)) -> None:
    expected = str(os.environ.get("INKGRID_ADMIN_TOKEN") or "").strip()
    if not expected:
        # Local dev fallback: allow access if token isn't configured.
        return
    if str(x_inkgrid_admin_token or "").strip() != expected:
        raise HTTPException(status_code=401, detail="Invalid admin token")


@app.get("/api/annotator/overrides/{stele_path:path}")
async def get_annotator_overrides(stele_path: str, _: None = Depends(require_admin)):
    try:
        return annotator_service.get_overrides(stele_path)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/annotator/overrides/{stele_path:path}")
async def save_annotator_overrides(
    stele_path: str, payload: dict, _: None = Depends(require_admin)
):
    try:
        return annotator_service.save_overrides(stele_path, payload)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/annotator/apply/{stele_path:path}")
async def apply_annotator_overrides(
    stele_path: str, payload: dict, _: None = Depends(require_admin)
):
    dataset_dir = str(payload.get("dataset_dir") or "").strip()
    only_files = payload.get("only_files")
    run_qa = bool(payload.get("run_qa", True))
    if only_files is not None and not isinstance(only_files, list):
        raise HTTPException(status_code=400, detail="only_files must be a list")

    try:
        return annotator_service.apply_overrides(
            stele_path,
            dataset_dir=dataset_dir,
            only_files=[str(x) for x in (only_files or [])],
            run_qa=run_qa,
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"Command failed: {e}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/annotator/datasets/{stele_path:path}")
async def list_annotator_datasets(stele_path: str, _: None = Depends(require_admin)):
    try:
        return annotator_service.list_datasets(stele_path)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/workbench/projects")
async def list_workbench_projects(_: None = Depends(require_admin)):
    return workbench_service.list_projects()


@app.post("/api/workbench/projects")
async def create_workbench_project(payload: dict, _: None = Depends(require_admin)):
    try:
        return workbench_service.create_project(payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/workbench/projects/{stele_slug}/pages")
async def upload_workbench_pages(
    stele_slug: str,
    files: list[UploadFile] = File(...),
    _: None = Depends(require_admin),
):
    try:
        paths = workbench_service._resolve_project_dir(stele_slug)
        paths.pages_raw_dir.mkdir(parents=True, exist_ok=True)
        saved: list[str] = []
        # Determine next index based on existing files.
        existing = sorted(
            [p for p in paths.pages_raw_dir.iterdir() if p.is_file()], key=lambda p: p.name
        )
        next_i = len(existing) + 1
        for f in files:
            ext = os.path.splitext(f.filename or "")[1].lower() or ".jpg"
            out_name = f"page_{next_i:02d}{ext}"
            next_i += 1
            out_path = paths.pages_raw_dir / out_name
            content = await f.read()
            out_path.write_bytes(content)
            saved.append(out_name)
        workbench_service.add_pages(stele_slug, saved)
        return {"saved": saved}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/workbench/projects/{stele_slug}")
async def get_workbench_project(stele_slug: str, _: None = Depends(require_admin)):
    try:
        return workbench_service.get_project(stele_slug)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/workbench/projects/{stele_slug}")
async def update_workbench_project(
    stele_slug: str, payload: dict, _: None = Depends(require_admin)
):
    try:
        return workbench_service.update_project(stele_slug, payload)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/api/workbench/projects/{stele_slug}/pages/{image_name}")
async def delete_workbench_page(
    stele_slug: str, image_name: str, _: None = Depends(require_admin)
):
    try:
        return workbench_service.delete_page(stele_slug, image_name)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/workbench/projects/{stele_slug}/pages/update")
async def update_workbench_pages(
    stele_slug: str, payload: dict, _: None = Depends(require_admin)
):
    try:
        return workbench_service.update_pages(stele_slug, payload)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/workbench/projects/{stele_slug}/jobs")
async def create_workbench_job(stele_slug: str, payload: dict, _: None = Depends(require_admin)):
    try:
        return workbench_service.create_job(stele_slug, payload)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/workbench/projects/{stele_slug}/text/fetch")
async def fetch_workbench_text(stele_slug: str, _: None = Depends(require_admin)):
    try:
        return workbench_service.fetch_text_candidates(stele_slug)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/workbench/projects/{stele_slug}/alignment")
async def save_workbench_alignment(
    stele_slug: str, payload: dict, _: None = Depends(require_admin)
):
    try:
        return workbench_service.save_alignment_text(stele_slug, payload)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/workbench/projects/{stele_slug}/alignment")
async def get_workbench_alignment(stele_slug: str, _: None = Depends(require_admin)):
    try:
        return workbench_service.get_alignment(stele_slug)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/workbench/projects/{stele_slug}/files/{path:path}")
async def get_workbench_file(stele_slug: str, path: str, _: None = Depends(require_admin)):
    try:
        paths = workbench_service._resolve_project_dir(stele_slug)
        rel = str(path or "").lstrip("/")
        target = (paths.stele_dir / rel).resolve()
        if not str(target).startswith(str(paths.stele_dir.resolve()) + os.sep):
            raise HTTPException(status_code=400, detail="Invalid path")
        if not target.exists() or not target.is_file():
            raise HTTPException(status_code=404, detail="File not found")
        return FileResponse(str(target))
    except HTTPException:
        raise
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/workbench/projects/{stele_slug}/list")
async def list_workbench_dir(stele_slug: str, path: str = "", _: None = Depends(require_admin)):
    try:
        paths = workbench_service._resolve_project_dir(stele_slug)
        rel = str(path or "").lstrip("/")
        target = (paths.stele_dir / rel).resolve()
        if not str(target).startswith(str(paths.stele_dir.resolve()) + os.sep):
            raise HTTPException(status_code=400, detail="Invalid path")
        if not target.exists() or not target.is_dir():
            raise HTTPException(status_code=404, detail="Dir not found")
        items = []
        for p in sorted(target.iterdir(), key=lambda x: x.name):
            try:
                st = p.stat()
                size = int(st.st_size)
            except Exception:
                size = 0
            rel_item = (Path(rel) / p.name).as_posix() if rel else p.name
            items.append(
                {
                    "name": p.name,
                    "is_dir": p.is_dir(),
                    "size": size,
                    "path": rel_item,
                    "url": None if p.is_dir() else f"/api/workbench/projects/{stele_slug}/files/{rel_item}",
                }
            )
        return {"path": rel, "items": items}
    except HTTPException:
        raise
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/workbench/projects/{stele_slug}/datasets/{dataset_dir}/overrides")
async def get_workbench_crop_overrides(
    stele_slug: str, dataset_dir: str, _: None = Depends(require_admin)
):
    try:
        paths = workbench_service._resolve_project_dir(stele_slug)
        ds = str(dataset_dir or "").strip().lstrip("/")
        overrides_path = (paths.stele_dir / "datasets" / ds / "crop_overrides.json").resolve()
        if not str(overrides_path).startswith(str(paths.stele_dir.resolve()) + os.sep):
            raise HTTPException(status_code=400, detail="Invalid dataset_dir")
        if not overrides_path.exists():
            return {"version": 1, "crop_overrides": {}}
        return json.loads(overrides_path.read_text(encoding="utf-8"))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/workbench/projects/{stele_slug}/datasets/{dataset_dir}/overrides")
async def save_workbench_crop_overrides(
    stele_slug: str, dataset_dir: str, payload: dict, _: None = Depends(require_admin)
):
    try:
        paths = workbench_service._resolve_project_dir(stele_slug)
        ds = str(dataset_dir or "").strip().lstrip("/")
        target_dir = (paths.stele_dir / "datasets" / ds).resolve()
        if not str(target_dir).startswith(str(paths.stele_dir.resolve()) + os.sep):
            raise HTTPException(status_code=400, detail="Invalid dataset_dir")
        target_dir.mkdir(parents=True, exist_ok=True)
        overrides_path = (target_dir / "crop_overrides.json").resolve()
        crop_overrides = payload.get("crop_overrides")
        if crop_overrides is None:
            crop_overrides = {}
        if not isinstance(crop_overrides, dict):
            raise HTTPException(status_code=400, detail="crop_overrides must be an object")
        out = {
            "version": 1,
            "crop_overrides": crop_overrides,
            "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        }
        overrides_path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return out
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/workbench/projects/{stele_slug}/jobs")
async def list_workbench_jobs(stele_slug: str, _: None = Depends(require_admin)):
    try:
        return workbench_service.list_jobs(stele_slug)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/workbench/projects/{stele_slug}/jobs/{job_id}")
async def get_workbench_job(
    stele_slug: str, job_id: str, _: None = Depends(require_admin)
):
    try:
        return workbench_service.get_job(stele_slug, job_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/steles")
async def list_steles():
    return alignment_service.list_steles()


@app.get("/api/steles/{name:path}")
async def get_stele_content(name: str):
    content = alignment_service.get_stele_content(name)
    if not content:
        return {"error": "Stele not found"}, 404
    return content


@app.get("/api/static/steles/{path:path}")
async def get_static_stele_file(path: str):
    file_location = os.path.join(PUBLIC_DIR, "steles", path)
    if os.path.exists(file_location):
        return FileResponse(file_location)
    return {"error": "File not found"}, 404


@app.get("/api/masterpieces")
async def list_masterpieces(script_type: str | None = None, q: str | None = None):
    return {
        "masterpieces": catalog_service.list_masterpieces(script_type=script_type, q=q)
    }


@app.get("/api/masterpieces/{sid}")
async def get_masterpiece(sid: str):
    stele = catalog_service.get_masterpiece(sid)
    if not stele:
        raise HTTPException(status_code=404, detail="Masterpiece not found")
    knowledge = catalog_service.get_knowledge_for_masterpiece(sid)
    return {"masterpiece": stele, "knowledge": knowledge}


@app.get("/api/masterpieces/{sid}/knowledge")
async def get_masterpiece_knowledge(sid: str):
    knowledge = catalog_service.get_knowledge_for_masterpiece(sid)
    if not knowledge:
        raise HTTPException(status_code=404, detail="Knowledge not found")
    return knowledge


@app.get("/")
async def read_root():
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return HTMLResponse("<h1>墨阵 InkGrid</h1><p>Frontend not built</p>")


if os.path.exists(STELES_DIR):
    app.mount("/steles", StaticFiles(directory=STELES_DIR), name="steles")


if os.path.exists(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="static")
