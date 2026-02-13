import os
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import numpy as np
from typing import List, Optional
import json
import cv2
from PIL import Image
import uuid

from app.services.alignment_service import AlignmentService
from app.services.grid_service import GridService
from app.services.ocr_engine import OCREngine
from app.services.sam_service import SAMService

app = FastAPI()

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # 允许前端地址
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 服务初始化
alignment_service = AlignmentService()
grid_service = GridService()
sam_service = SAMService()

# OCR 延迟初始化（避免启动时加载失败）
ocr_engine = None


def get_ocr_engine():
    global ocr_engine
    if ocr_engine is None:
        from app.services.ocr_engine import OCREngine

        ocr_engine = OCREngine()
    return ocr_engine


UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)


# API 定义
@app.get("/", response_class=HTMLResponse)
async def read_root():
    return "<h1>墨阵 InkGrid Backend is Running</h1>"


@app.get("/api/image/{image_path:path}")
async def get_image(image_path: str):
    file_location = os.path.join(UPLOAD_DIR, image_path)
    if not os.path.exists(file_location):
        return {"error": "Image not found"}
    return FileResponse(file_location)


@app.get("/api/steles")
async def list_steles():
    return alignment_service.list_steles()


@app.get("/api/steles/{name:path}")
async def get_stele_content(name: str):
    content = alignment_service.get_stele_content(name)
    if not content:
        return {"error": "Stele not found"}, 404
    return content


# Grid 相关的 API 路由
@app.post("/api/grid/detect")
async def detect_grid(file: UploadFile = File(...), expected_chars: int = 135):
    file_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{file.filename}")
    with open(file_path, "wb") as f:
        f.write(await file.read())

    img_np = np.array(Image.open(file_path).convert("RGB"))
    h_lines, v_lines = grid_service.detect_grid_lines(
        img_np, expected_chars=expected_chars
    )

    return {
        "image_path": os.path.basename(file_path),
        "h_lines": h_lines,
        "v_lines": v_lines,
        "width": img_np.shape[1],
        "height": img_np.shape[0],
    }


@app.post("/api/grid/align")
async def align_characters(data: dict):
    image_path = data["image_path"]
    v_lines = data["v_lines"]
    h_lines = data["h_lines"]
    stele_name = data["stele_name"]
    offset = data.get("offset", 0)

    img_path_full = os.path.join(UPLOAD_DIR, image_path)
    if not os.path.exists(img_path_full):
        return {"error": "Image not found"}, 404

    img_cv = cv2.imread(img_path_full)
    characters = alignment_service.align_characters(
        img_cv, h_lines, v_lines, stele_name, ocr_engine, offset
    )
    return {"characters": characters}


@app.post("/api/grid/auto_match")
async def auto_match_offset(data: dict):
    image_path = data["image_path"]
    v_lines = data["v_lines"]
    h_lines = data["h_lines"]
    stele_name = data["stele_name"]

    img_path_full = os.path.join(UPLOAD_DIR, image_path)
    if not os.path.exists(img_path_full):
        return {"error": "Image not found"}, 404

    img_cv = cv2.imread(img_path_full)
    offset = alignment_service.auto_calculate_offset(
        img_cv, h_lines, v_lines, stele_name, ocr_engine
    )
    return {"offset": offset}


# OCR / SAM 相关的 API 路由
@app.post("/api/segment")
async def segment_image(data: dict):
    image_path = data["image_path"]

    img_path_full = os.path.join(UPLOAD_DIR, image_path)
    if not os.path.exists(img_path_full):
        return {"error": "Image not found"}, 404

    original_image = Image.open(img_path_full).convert("RGB")

    # Handle both bbox and coordinate-based requests
    if "bbox" in data:
        # Traditional bbox format [x1, y1, x2, y2] or [x, y, width, height]
        bbox = data["bbox"]
        mask_image_path = sam_service.segment_image(original_image, bbox)
    elif "x" in data and "y" in data:
        # Coordinate-based request - create a small bbox around the click point
        x, y = data["x"], data["y"]
        # Create a small bounding box around the clicked point (adjust size as needed)
        # Format: [x1, y1, x2, y2]
        bbox_size = 50  # Size of the bounding box around the click point
        bbox = [
            int(x - bbox_size / 2),
            int(y - bbox_size / 2),
            int(x + bbox_size / 2),
            int(y + bbox_size / 2),
        ]

        # Ensure bbox stays within image bounds
        img_width, img_height = original_image.size
        bbox[0] = max(0, bbox[0])  # x1
        bbox[1] = max(0, bbox[1])  # y1
        bbox[2] = min(img_width, bbox[2])  # x2
        bbox[3] = min(img_height, bbox[3])  # y2

        mask_image_path = sam_service.segment_image(original_image, bbox)
    else:
        return {
            "error": "Either 'bbox' or 'x' and 'y' coordinates must be provided"
        }, 400

    return {"mask_image_path": mask_image_path}


@app.post("/api/export")
async def export_characters(data: dict):
    image_path = data["image_path"]
    characters = data["characters"]
    stele_name = data["stele_name"]

    img_path_full = os.path.join(UPLOAD_DIR, image_path)
    if not os.path.exists(img_path_full):
        return {"error": "Image not found"}, 404

    original_image = Image.open(img_path_full).convert("RGB")
    output_dir = os.path.join("exported_characters", stele_name.replace(" ", "_"))
    os.makedirs(output_dir, exist_ok=True)

    for char_info in characters:
        bbox = char_info["bbox"]
        char_img = original_image.crop(bbox)
        filename = f"{stele_name}_{char_info['simplified']}_{char_info['pinyin']}.jpg"
        char_img.save(os.path.join(output_dir, filename))

    return {"message": f"Exported {len(characters)} characters to {output_dir}"}


# if __name__ == "__main__":
#     uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
