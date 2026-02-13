import os
from fastapi import FastAPI
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.services.alignment_service import AlignmentService
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


@app.get("/")
async def read_root():
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return HTMLResponse("<h1>墨阵 InkGrid</h1><p>Frontend not built</p>")


# Mount steles static files before frontend static files
if os.path.exists(os.path.join(PUBLIC_DIR, "steles")):
    app.mount(
        "/steles",
        StaticFiles(directory=os.path.join(PUBLIC_DIR, "steles")),
        name="steles",
    )

if os.path.exists(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="static")
