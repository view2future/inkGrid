#!/bin/bash
# docker-start.sh - Container-friendly startup script

set -e

echo "======================================="
echo "   墨阵 InkGrid | Docker 容器启动"
echo "======================================="

# Use PORT from environment variable (Zeabur uses $PORT)
PORT=${PORT:-8000}
echo ">>> 使用端口: $PORT"

# 1. Start backend service
echo ">>> 启动后端服务 (FastAPI)..."
export PYTHONPATH=$PYTHONPATH:/app/backend
exec uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT --reload --workers 1