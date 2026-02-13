#!/bin/bash

# 简化版启动脚本 - 只启动 FastAPI 服务
echo "======================================="
echo "   墨阵 InkGrid | 简化版启动"
echo "======================================="

# 设置端口
PORT=${PORT:-8000}
echo ">>> 使用端口: $PORT"

# 启动后端服务，但避免加载可能引起 cv2 导入的模块
cd /app/backend

# 直接运行 Python 脚本，不使用 uvicorn 模块导入方式
python -c "
import sys
import os
sys.path.insert(0, '.')

# 临时禁用可能导致 cv2 导入的模块
import importlib.util

# 手动导入必要的模块，避免自动导入
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# 创建应用
app = FastAPI(title='墨阵 InkGrid API')

@app.get('/', response_class=HTMLResponse)
async def read_root():
    return '<h1>墨阵 InkGrid Backend is Running (Minimal Version)</h1>'

@app.get('/health')
async def health_check():
    return {'status': 'healthy', 'service': 'inkGrid-backend'}

if __name__ == '__main__':
    uvicorn.run(app, host='0.0.0.0', port=int(os.environ.get('PORT', 8000)))
"