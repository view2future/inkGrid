#!/bin/bash

# 部署脚本 - 准备 inkGrid 项目部署到 Zeabur

echo "🔍 检查 Docker 构建状态..."
BUILD_STATUS=$(docker ps -a --format "table {{.Names}}\t{{.Status}}" | grep inkgrid-build)

if [ -z "$BUILD_STATUS" ]; then
    echo "📦 开始构建 Docker 镜像..."
    docker build -t inkgrid:latest -f Dockerfile.optimized . &
    BUILD_PID=$!
    echo "✅ 构建进程已启动，PID: $BUILD_PID"
else
    echo "🔄 构建已在进行中"
fi

echo "📝 检查部署所需文件..."

# 检查关键文件是否存在
REQUIRED_FILES=(
    "Dockerfile.optimized"
    "docker-start.sh"
    "backend/requirements.txt"
    "backend/app/main.py"
    "ZEABUR_DEPLOYMENT.md"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ] && [ ! -d "$file" ]; then
        echo "❌ 缺少必要文件: $file"
        exit 1
    else
        echo "✅ 已找到: $file"
    fi
done

echo ""
echo "🎯 部署准备就绪！"
echo ""
echo "要部署到 Zeabur，请执行以下步骤："
echo "1. 将代码推送到 GitHub/GitLab"
echo "2. 在 Zeabur 控制台中创建新服务"
echo "3. 选择 'Docker' 部署方式"
echo "4. 使用 'Dockerfile.optimized' 作为 Dockerfile"
echo "5. 设置健康检查路径为 '/health'"
echo ""
echo "或者，您可以本地测试镜像："
echo "   docker run -p 8000:8000 inkgrid:latest"