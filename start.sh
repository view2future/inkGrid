#!/bin/bash

# 确保在项目根目录运行
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "======================================="
echo "   墨阵 InkGrid | 服务启动程序 (简约版)"
echo "======================================="

# 0. 预清理
echo ">>> 正在清理旧的服务资源..."
./stop.sh > /dev/null 2>&1

# 1. 检查并启动后端 (FastAPI)
echo ">>> 正在检查后端虚拟环境..."
if [ ! -d "backend/venv" ]; then
    echo "    正在创建虚拟环境..."
    python3 -m venv backend/venv
fi

# 安装精简后的依赖
echo ">>> 正在同步后端依赖..."
source backend/venv/bin/activate && pip install -q -r backend/requirements.txt

echo ">>> 正在启动后端 API 服务..."
export PYTHONPATH=$PYTHONPATH:$(pwd)/backend
nohup backend/venv/bin/python3 -u -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > backend/backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > backend/.backend.pid

# 2. 检查并启动前端 (Vite/React)
echo ">>> 正在启动前端服务 (Vite/React)..."
if [ -d "frontend" ]; then
    cd frontend
    # 假设依赖已安装，若不确定可以先 npm install
    npm run dev > frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > .frontend.pid
    cd ..
    echo "[OK] 前端已在后台运行 (PID: $FRONTEND_PID)"
else
    echo "[ERROR] 未找到 frontend 目录"
fi

echo "---------------------------------------"
echo "服务已就绪 (简约版)！"
echo "- 访问链接: http://localhost:5173"
echo "---------------------------------------"
