import os
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.services.alignment_service import AlignmentService
from app.services.catalog_service import CatalogService
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
