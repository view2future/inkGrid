#!/bin/bash

# 确保在项目根目录运行
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "======================================="
echo "   墨阵 InkGrid | 服务停止程序"
echo "======================================="

# 1. 停止后端
if [ -f .backend.pid ]; then
    PID=$(cat .backend.pid)
    echo ">>> 正在停止后端服务 (PID: $PID)..."
    kill $PID 2>/dev/null
    # 确保进程确实已消失
    sleep 1
    if ps -p $PID > /dev/null; then
        echo "    正在强制结束后端进程..."
        kill -9 $PID 2>/dev/null
    fi
    rm .backend.pid
    echo "[OK] 后端服务已停止"
else
    echo "[-] 未发现运行中的后端服务记录"
fi

# 2. 停止前端
if [ -f .frontend.pid ]; then
    PID=$(cat .frontend.pid)
    echo ">>> 正在停止前端服务 (PID: $PID)..."
    # Vite 启动后会产生子进程，尝试递归杀死进程树
    pkill -P $PID 2>/dev/null
    kill $PID 2>/dev/null
    sleep 1
    if ps -p $PID > /dev/null; then
        echo "    正在强制结束前端进程..."
        kill -9 $PID 2>/dev/null
    fi
    rm .frontend.pid
    echo "[OK] 前端服务已停止"
else
    echo "[-] 未发现运行中的前端服务记录"
fi

# 3. 清理残留的 uvicorn/vite 进程
# 针对可能没被 PID 捕捉到的子进程进行深度清理
echo ">>> 正在清理残留进程..."
pkill -f "uvicorn app.main:app" 2>/dev/null
pkill -f "vite" 2>/dev/null

echo "---------------------------------------"
echo "所有服务已平稳停止。"
echo "======================================="