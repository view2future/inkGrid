#!/bin/bash

# 启动 inkGrid 应用
# 使用环境变量 PORT，如果没有则默认为 8000
PORT=${PORT:-8000}

echo "======================================="
echo "   墨阵 InkGrid | Docker 容器启动"
echo "======================================="
echo ">>> 使用端口: $PORT"
echo ">>> 启动后端服务 (FastAPI)..."

# 启动后端服务器
cd /app/backend
exec uvicorn app.main:app --host 0.0.0.0 --port $PORT --forwarded-allow-ips '*'