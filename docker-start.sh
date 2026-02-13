#!/bin/bash

echo "==========================================="
echo "   墨阵 InkGrid | 全栈启动 (Zeabur 优化版)"
echo "==========================================="

# Use PORT from environment (Zeabur sets this)
PORT=${PORT:-8000}

echo ">>> 使用端口: $PORT"
echo ">>> 启动后端服务 (FastAPI) on internal port 8001..."

# Start backend service in background
cd /app/backend
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --workers 1 &

# Wait for backend to start
sleep 5

# Verify backend is running
if ! curl -sf http://127.0.0.1:8001/health >/dev/null 2>&1; then
    echo "ERROR: Backend service failed to start"
    exit 1
fi

echo ">>> 后端服务启动成功"
echo ">>> 启动 Nginx 服务器，提供前端界面..."

# Start Nginx to serve frontend and proxy API requests
exec nginx -g "daemon off;"
