# inkGrid - 部署到 Zeabur

## 项目概述

inkGrid 是一个基于深度学习的中文书法网格生成器，能够自动识别和生成练习网格。此版本包含完整的前端界面和后端服务。

## 部署到 Zeabur

### 部署步骤

1. **推送代码到 GitHub**
   ```bash
   git add .
   git commit -m "feat: add fullstack Docker support for Zeabur deployment"
   git push origin main
   ```

2. **在 Zeabur 中创建服务**
   - 登录 [Zeabur](https://zeabur.com)
   - 点击 "Create Service"
   - 选择 "Git Provider" (GitHub/GitLab等)
   - 选择您的 inkGrid 仓库
   - 选择 "Docker" 作为部署方式
   - Zeabur 会自动使用项目根目录下的 `Dockerfile`

3. **配置服务**
   - 端口：8000 (Dockerfile 中已配置)
   - 健康检查路径：`/health`
   - 环境变量：Zeabur 会自动设置 `$PORT` 环境变量

4. **部署**
   - 点击 "Deploy" 开始部署
   - 等待构建完成

### 架构说明

- **前端**：React + TypeScript 构建的 SPA，提供首页、墨廊、峄山刻石、墨流等功能
- **后端**：FastAPI 提供 RESTful API 服务
- **Web 服务器**：Nginx 服务前端静态文件并代理 API 请求到后端
- **端口**：所有流量通过 8000 端口进入，Nginx 负责分发

### 功能特性

- **首页**：展示5个篆体字轮转，左下角墨廊入口，右下角峄山刻石赏析入口
- **墨廊**：碑帖展示画廊
- **峄山刻石**：峄山刻石专题页面
- **墨流**：互动式字符学习体验

### 环境变量

- `$PORT`：由 Zeabur 自动设置，应用会自动使用此端口

### 健康检查

- 路径：`/health`
- 返回：JSON 格式的健康状态

### 注意事项

- 构建时间可能较长，因为需要构建前端和安装依赖
- 首次启动可能需要一些时间，因为需要预加载数据
- 前端资源通过 Nginx 高效服务