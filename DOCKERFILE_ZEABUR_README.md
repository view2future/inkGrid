# inkGrid - Dockerfile for Zeabur Deployment

这个 Dockerfile 专门用于在 Zeabur 上部署 inkGrid 全栈应用，确保首页的篆体字轮转、墨廊入口和峄山刻石赏析入口都能正常显示。

## 特性

- **前端构建**：使用 Node.js 构建 React 前端应用
- **后端服务**：运行 FastAPI 后端服务
- **Nginx 服务**：提供前端静态文件并代理 API 请求到后端
- **完整界面**：包含首页（5个篆体字轮转）、墨廊、峄山刻石、墨流等完整功能
- **健康检查**：提供 `/health` 端点用于服务监控
- **端口适配**：自动使用 `$PORT` 环境变量（Zeabur 标准）

## 部署到 Zeabur

1. 推送代码到 GitHub
2. 在 Zeabur 中创建新服务
3. 选择 "Docker" 部署方式
4. 使用默认的 Dockerfile
5. 设置健康检查路径为 `/health`

## 架构

- **前端**：React SPA，提供首页（5个篆体字轮转）、墨廊、峄山刻石、墨流等功能
- **后端**：FastAPI 服务 API 请求
- **Web 服务器**：Nginx 服务前端资产并代理 API 请求到后端
- **端口**：所有流量通过 8000 端口进入，Nginx 负责内部路由