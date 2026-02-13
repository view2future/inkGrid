#!/bin/bash

# 确保在项目根目录运行
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "======================================="
echo "   墨阵 InkGrid | 服务启动程序"
echo "======================================="

# 0. 预清理：确保旧服务已停止
echo ">>> 正在清理旧的服务资源..."
./stop.sh > /dev/null 2>&1

# 1. 检查并启动后端 (FastAPI)
echo ">>> 正在检查后端虚拟环境..."
if [ ! -d "backend/venv" ]; then
    echo "    正在创建虚拟环境 (仅首次启动需执行)..."
    python3 -m venv backend/venv
fi

# 激活虚拟环境并安装依赖
echo ">>> 正在同步后端依赖 (这可能需要一点时间)..."
source backend/venv/bin/activate && pip install -r backend/requirements.txt > /dev/null 2>&1

# 预下载 cnocr 模型（如果不存在）
echo ">>> 正在检查 AI 模型状态..."
python -c "from cnocr import CnOcr; CnOcr()" > /dev/null 2>&1

echo ">>> 正在启动后端服务 (FastAPI)..."
# 使用 `python -m uvicorn` 更可靠地启动
export PYTHONPATH=$PYTHONPATH:$(pwd)/backend
nohup backend/venv/bin/python3 -u -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > backend/backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > backend/.backend.pid
echo "正在等待后端服务启动 (最多 30 秒)..."
timeout=30
while ! nc -z localhost 8000; do
  sleep 1
  timeout=$((timeout - 1))
  if [ $timeout -le 0 ]; then
      echo "[ERROR] 后端启动超时，请检查日志: backend/backend.log"
      exit 1
  fi
done
echo "[OK] 后端已在虚拟环境中运行 (PID: $BACKEND_PID)"

# 2. 检查并启动前端 (Vite/React)
echo ">>> 正在启动前端服务 (Vite/React)..."
if [ -d "frontend" ]; then
    cd frontend
    npm run dev > frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > .frontend.pid
    cd ..
    echo "[OK] 前端已在后台运行 (PID: $FRONTEND_PID)，端口: 5173"
else
    echo "[ERROR] 未找到 frontend 目录"
fi

echo "---------------------------------------"
echo "服务已全部就绪！"
echo "- 后端日志: tail -f backend/backend.log"
echo "- 前端日志: tail -f frontend/frontend.log"
echo "- 访问链接: http://localhost:5173"
echo "---------------------------------------"
echo "使用 ./stop.sh 可一键停止服务。"