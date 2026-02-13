#!/bin/bash

# 确保在项目根目录运行
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "======================================="
echo "   墨阵 InkGrid | 服务停止程序"
echo "======================================="

# 1. 停止后端
if [ -f "backend/.backend.pid" ]; then
    PID=$(cat backend/.backend.pid)
    echo ">>> 正在停止后端服务 (PID: $PID)..."
    kill $PID 2>/dev/null
    rm backend/.backend.pid
    echo "[OK] 后端服务已停止"
else
    # 尝试按名称清理
    pkill -f "uvicorn app.main:app" 2>/dev/null
fi

# 2. 停止前端
if [ -f "frontend/.frontend.pid" ]; then
    PID=$(cat frontend/.frontend.pid)
    echo ">>> 正在停止前端服务 (PID: $PID)..."
    pkill -P $PID 2>/dev/null
    kill $PID 2>/dev/null
    rm frontend/.frontend.pid
    echo "[OK] 前端服务已停止"
else
    pkill -f "vite" 2>/dev/null
fi

echo "---------------------------------------"
echo "所有服务已停止。"
echo "======================================="
