import os
from fastapi import FastAPI
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from typing import List, Optional

from app.services.alignment_service import AlignmentService
from app.health import router as health_router

app = FastAPI(title="墨阵 InkGrid API")
app.include_router(health_router)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 简化环境下允许所有来源，生产环境应限制
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 服务初始化
alignment_service = AlignmentService()

@app.get("/", response_class=HTMLResponse)
async def read_root():
    return "<h1>墨阵 InkGrid Backend is Running (Lean Version)</h1>"

@app.get("/api/steles")
async def list_steles():
    """获取碑帖列表"""
    return alignment_service.list_steles()

@app.get("/api/steles/{name:path}")
async def get_stele_content(name: str):
    """获取指定碑帖的详细内容（字形、释义等）"""
    content = alignment_service.get_stele_content(name)
    if not content:
        return {"error": "Stele not found"}, 404
    return content

# 静态资源处理
@app.get("/api/static/steles/{path:path}")
async def get_static_stele_file(path: str):
    """分发碑帖静态图片"""
    # 假设图片存储在公共目录或特定路径
    # 这里可以根据实际情况调整
    base_path = "public/steles" 
    file_location = os.path.join(base_path, path)
    if os.path.exists(file_location):
        return FileResponse(file_location)
    return {"error": "File not found"}, 404

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
