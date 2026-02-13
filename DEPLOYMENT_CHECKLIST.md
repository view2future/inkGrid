# inkGrid - Zeabur 部署清单

## 部署准备状态：✅ 已完成

### 已完成的部署准备工作：

1. **Docker 支持**：
   - ✅ 创建了优化的 `Dockerfile`（支持多阶段构建）
   - ✅ 修复了前端依赖问题（使用 npm 而非 yarn）
   - ✅ 添加了 `.dockerignore` 文件

2. **健康检查端点**：
   - ✅ 在后端添加了 `/health` 端点
   - ✅ 更新了 `main.py` 以包含健康检查路由

3. **容器化启动脚本**：
   - ✅ `docker-start.sh` - 容器友好的启动脚本
   - ✅ 支持 Zeabur 的 `$PORT` 环境变量

4. **部署文档**：
   - ✅ 更新了 `README.md` 包含部署说明
   - ✅ 创建了 `ZEABUR_DEPLOYMENT.md` 详细部署指南

5. **代码仓库优化**：
   - ✅ 清理了大型文件（>30MB）
   - ✅ 确保所有依赖项正确配置

### 部署到 Zeabur 的步骤：

1. **推送代码到 GitHub**：
   ```bash
   git add .
   git commit -m "feat: add Docker support for Zeabur deployment"
   git push origin main
   ```

2. **在 Zeabur 中创建服务**：
   - 登录 Zeabur 控制台
   - 选择 "Create Service"
   - 连接您的 GitHub 仓库
   - 选择 "Docker" 部署方式
   - 使用默认的 `Dockerfile`
   - 设置健康检查路径为 `/health`

3. **验证部署**：
   - 访问分配的 URL
   - 检查 `/health` 端点返回状态
   - 测试 OCR 功能

### 已修复的依赖问题：

- **OpenCV 依赖问题**：已添加所有必要的系统库（libxcb1、libglib2.0-0 等）以避免 `ImportError: libxcb.so.1: cannot open shared object file` 错误
- **OCR 功能支持**：确保所有 OCR 相关库都能正确加载

### 技术细节：

- 应用程序设计为使用 `$PORT` 环境变量（Zeabur 标准）
- Dockerfile 使用多阶段构建以减小最终镜像大小
- 前端构建（如果需要）和后端服务集成在一个镜像中
- 使用非 root 用户提高安全性
- 包含健康检查机制

### 预期资源需求：

- 内存：由于使用深度学习模型，建议至少 2GB RAM
- CPU：OCR 处理需要一定计算能力
- 启动时间：首次启动可能需要较长时间（模型加载）

### 故障排除：

- 如果构建失败，请检查 Dockerfile 中的依赖项
- 如果服务无法启动，请检查日志中的端口绑定错误
- OCR 功能需要大量内存，确保实例规格足够