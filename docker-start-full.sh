#!/bin/bash

# 启动 inkGrid 应用 - 前后端分离架构
# Nginx 服务前端并代理 API 请求到后端

echo "======================================="
echo "   墨阵 InkGrid | 完整版启动"
echo "======================================="
echo ">>> 启动后端服务 (FastAPI)..."
echo ">>> 启动前端服务 (Nginx)..."

# 设置端口
PORT=${PORT:-8000}

# 启动后端服务
cd /app/backend
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --workers 1 &

# 等待后端启动
sleep 5

# 启动 Nginx（它会监听 $PORT 并代理请求到后端）
echo ">>> 启动 Nginx 服务器..."
nginx -g "daemon off;"