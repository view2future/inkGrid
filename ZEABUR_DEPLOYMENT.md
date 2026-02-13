# inkGrid - 部署到 Zeabur

## 项目概述
inkGrid 是一个基于深度学习的中文书法网格生成器，能够自动识别和生成书法练习网格。

## 部署说明

### 方法 1: 使用 Docker (推荐)
1. 在 Zeabur 中创建新服务
2. 选择 "Docker" 部署方式
3. 使用 `Dockerfile.optimized` 作为 Dockerfile
4. 环境变量设置：
   - `PORT`: 8000 (Zeabur 会自动设置)
5. 健康检查路径：`/health`

### 方法 2: 直接部署代码
1. 在 Zeabur 中创建新服务
2. 选择 "Git" 部署方式
3. 连接到此仓库
4. 构建命令：
   ```bash
   cd backend && pip install -r requirements.txt
   ```
5. 启动命令：
   ```bash
   cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```

## 环境变量
- `PORT`: 应用监听端口 (由 Zeabur 自动设置)
- `PYTHONPATH`: 包含 backend 目录

## 健康检查
应用提供 `/health` 端点用于健康检查

## 注意事项
- 应用需要大量内存来加载深度学习模型
- 首次启动可能较慢，因为需要加载模型
- OCR 功能依赖于 cnocr 和相关模型文件