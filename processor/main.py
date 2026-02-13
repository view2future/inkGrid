"""
InkGrid Processor API

FastAPI application for stele image analysis using VLM (KIMI API).

Endpoints:
- POST /v1/tasks/segment - Submit a stele image for segmentation
- POST /v1/tasks/region - Submit a region for re-analysis
- POST /v1/tasks/batch - Submit multiple images for batch processing
- GET /v1/tasks/{task_id} - Get task status
- GET /v1/tasks/{task_id}/result - Get task result
"""

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Body
from fastapi.responses import JSONResponse
from celery.result import AsyncResult
from pydantic import BaseModel
from typing import List, Optional
import shutil
import os
import uuid

from celery_app import process_stele, process_region, process_batch, celery_app

app = FastAPI(
    title="InkGrid Processor",
    description="VLM-powered Chinese Calligraphy Stele Analysis API",
    version="2.0.0"
)

UPLOAD_DIR = "/tmp/inkgrid_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


class RegionRequest(BaseModel):
    """Request model for region analysis."""
    x: int
    y: int
    width: int
    height: int
    stele_name: str = "Unknown"
    script_type: str = "篆书"


class BatchItem(BaseModel):
    """Single item in batch processing request."""
    stele_name: str
    script_type: str = "篆书"


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "inkgrid-processor",
        "version": "2.0.0",
        "vlm_providers": ["gemini", "kimi"]
    }


@app.get("/")
def root():
    """Root endpoint."""
    return {
        "message": "InkGrid Processor Service (VLM Refactor) is running",
        "docs": "/docs",
        "version": "2.0.0",
        "default_provider": "gemini"
    }


@app.post("/v1/tasks/segment")
async def submit_segmentation_task(
    file: UploadFile = File(..., description="Stele image file"),
    stele_name: str = Form(..., description="Name of the stele (e.g., 峄山刻石)"),
    script_type: str = Form("篆书", description="Script type: 篆书, 隶书, 楷书"),
    ground_truth_hint: Optional[str] = Form(None, description="Optional ground truth text hint"),
    provider: str = Form("gemini", description="VLM Provider: gemini or kimi")
):
    """
    Submit a stele image for VLM-driven segmentation and analysis.
    """
    # ... existing file save logic ...
    # Validate file type
    allowed_types = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed: {allowed_types}")
    
    # Save file
    file_id = str(uuid.uuid4())
    ext = file.filename.split('.')[-1].lower()
    if ext not in ['jpg', 'jpeg', 'png', 'webp']:
        ext = 'jpg'
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}.{ext}")
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Trigger Celery Task with provider
        task = process_stele.delay(file_path, stele_name, script_type, provider=provider)
        
        return {
            "task_id": task.id,
            "status": "submitted",
            "message": "Task processing in background",
            "estimated_time": "30-60 seconds"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/v1/tasks/region")
async def submit_region_task(
    file: UploadFile = File(..., description="Full stele image file"),
    region: str = Form(..., description="JSON string with x, y, width, height"),
    stele_name: str = Form("Unknown", description="Name of the stele"),
    script_type: str = Form("篆书", description="Script type"),
    provider: str = Form("gemini", description="VLM Provider")
):
    """
    Submit a specific region of a stele image for re-analysis.
    """
    import json
    
    try:
        region_data = json.loads(region)
        bbox = [region_data['x'], region_data['y'], region_data['width'], region_data['height']]
    except (json.JSONDecodeError, KeyError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid region format: {e}")
    
    # Save file
    file_id = str(uuid.uuid4())
    ext = file.filename.split('.')[-1].lower()
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}.{ext}")
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Trigger region task with provider
        task = process_region.delay(file_path, bbox, stele_name, script_type, provider=provider)
        
        return {
            "task_id": task.id,
            "status": "submitted",
            "message": f"Region analysis task submitted for bbox {bbox} using {provider}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/v1/tasks/batch")
async def submit_batch_task(
    files: List[UploadFile] = File(..., description="Multiple stele image files"),
    metadata: str = Form(..., description="JSON array of BatchItem matching files order"),
    provider: str = Form("gemini", description="VLM Provider")
):
    """
    Submit multiple stele images for batch processing.
    """
    import json
    
    if len(files) == 0:
        raise HTTPException(status_code=400, detail="No files provided")
    
    try:
        meta_list = json.loads(metadata)
        if len(meta_list) != len(files):
            raise HTTPException(status_code=400, detail="Metadata count must match file count")
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid metadata JSON: {e}")
    
    batch_data = []
    
    for i, (file, meta) in enumerate(zip(files, meta_list)):
        file_id = str(uuid.uuid4())
        ext = file.filename.split('.')[-1].lower()
        if ext not in ['jpg', 'jpeg', 'png', 'webp']:
            ext = 'jpg'
        file_path = os.path.join(UPLOAD_DIR, f"{file_id}.{ext}")
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        batch_data.append({
            "image_path": file_path,
            "stele_name": meta.get("stele_name", f"unknown_{i}"),
            "script_type": meta.get("script_type", "篆书")
        })
    
    # Trigger batch task with provider
    task = process_batch.delay(batch_data, provider=provider)
    
    return {
        "task_id": task.id,
        "status": "submitted",
        "message": f"Batch task submitted with {len(files)} images",
        "estimated_time": f"{len(files) * 30}-{len(files) * 60} seconds"
    }


@app.get("/v1/tasks/{task_id}")
def get_task_status(task_id: str):
    """Get the status of a submitted task."""
    task_result = AsyncResult(task_id, app=celery_app)
    
    response = {
        "task_id": task_id,
        "status": task_result.status,
    }
    
    if task_result.status == 'PROGRESS':
        response['progress'] = task_result.info.get('progress', 0)
        response['status_text'] = task_result.info.get('status', 'Processing')
    
    if task_result.ready():
        response['result'] = task_result.result
    
    return response


@app.get("/v1/tasks/{task_id}/result")
def get_task_result(task_id: str):
    """Get the result of a completed task."""
    task_result = AsyncResult(task_id, app=celery_app)
    
    if not task_result.ready():
        return {"status": task_result.status, "message": "Task is still processing"}
    
    if task_result.status == "SUCCESS":
        return task_result.result
    else:
        raise HTTPException(status_code=500, detail={
            "status": "failed",
            "error": task_result.result.get('error', 'Unknown error'),
            "traceback": task_result.result.get('traceback', '')
        })


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
