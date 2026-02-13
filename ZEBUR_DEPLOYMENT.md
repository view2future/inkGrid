# inkGrid - 部署到 Zeabur

## 镜像已构建

Docker 镜像 `inkgrid:latest` 已成功构建，可以直接部署到 Zeabur。

## 部署到 Zeabur

### 方法 1: 使用 GitHub 集成（推荐）

1. 将此代码库推送到 GitHub
2. 登录 [Zeabur](https://zeabur.com)
3. 点击 "Create Service"
4. 选择 GitHub 并授权访问您的仓库
5. 选择您的 inkGrid 仓库
6. 在部署配置中：
   - 构建方式：Docker
   - Dockerfile 路径：`Dockerfile`
   - 环境：Production
7. 部署服务

### 方法 2: 使用已构建的镜像

如果您想直接使用已构建的镜像：

1. 推送镜像到容器注册表（如 Docker Hub）
   ```bash
   docker tag inkgrid:latest <your-dockerhub-username>/inkgrid:latest
   docker push <your-dockerhub-username>/inkgrid:latest
   ```

2. 在 Zeabur 中创建服务时选择 "Image" 选项
3. 输入镜像名称：`<your-dockerhub-username>/inkgrid:latest`

## 服务配置

- 端口：8000
- 健康检查路径：`/health`
- 环境变量：Zeabur 会自动设置 `$PORT` 环境变量

## 功能

- **首页**：墨阵主界面
- **墨廊**：碑帖展示画廊
- **峄山刻石**：峄山刻石专题页面
- **墨流**：互动式字符学习体验

## 技术栈

- 前端：React + TypeScript + Vite
- 后端：FastAPI + Python 3.12
- 构建：Docker 多阶段构建
- 部署：Zeabur 云平台

## 注意事项

- 应用会自动使用 `$PORT` 环境变量
- 前端构建产物已包含在镜像中
- 静态资源通过后端 API 提供