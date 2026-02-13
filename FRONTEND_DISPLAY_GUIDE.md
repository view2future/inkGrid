# inkGrid - 部署说明（前端显示版）

## 问题诊断

如果您在访问应用时看到 "墨阵 InkGrid Backend is Running (Lean Version)" 而不是预期的首页（带有5个篆体字轮转、墨廊入口、峄山刻石赏析入口），这表示请求直接到达了后端服务，而不是通过 Nginx 提供前端页面。

## 解决方案

### 1. 确保 Dockerfile 配置正确

当前的 Dockerfile 使用 Supervisor 同时管理：
- **后端服务**：在内部 127.0.0.1:8001 运行，处理 API 请求
- **Nginx 服务**：在外部 0.0.0.0:8000 运行，提供前端页面并代理 API 请求

### 2. Nginx 配置说明

Nginx 配置确保：
- 所有非 API 请求（如 `/`、`/gallery`、`/yishan` 等）都被路由到 `/index.html`
- API 请求（以 `/api/` 开头）被代理到后端服务
- 静态资源（如 JS、CSS、图片）被直接提供

### 3. 部署到 Zeabur

1. **推送代码**：
   ```bash
   git add .
   git commit -m "feat: fix frontend display with proper nginx configuration"
   git push origin main
   ```

2. **在 Zeabur 中部署**：
   - 创建新服务
   - 选择 Docker 部署方式
   - 使用默认的 Dockerfile
   - 确保端口设置为 8000
   - 健康检查路径设为 `/health`

### 4. 验证部署

部署完成后，访问：
- **首页**：`https://your-app-url.zeabur.app/` - 应显示首页（5个篆体字轮转）
- **健康检查**：`https://your-app-url.zeabur.app/health` - 应返回健康状态
- **API 文档**：`https://your-app-url.zeabur.app/docs` - 应显示 API 文档

### 5. 故障排除

如果仍然看到后端消息：

1. **检查端口配置**：确保 Zeabur 使用 8000 端口
2. **检查健康检查**：确认健康检查路径为 `/health` 而不是 `/`
3. **等待完全启动**：首次启动可能需要几分钟时间
4. **检查日志**：在 Zeabur 控制台查看部署日志

### 6. 预期的首页内容

正确的首页应包含：
- 页面中央：5个篆体字轮转显示
- 左下角：墨廊入口
- 右下角：峄山刻石赏析入口
- 背景：动态水墨效果
- 完整的导航和交互功能

## 架构说明

```
外部请求 -> 端口 8000 -> Nginx (提供前端页面) -> 静态资源
                                    |
                                    -> API 请求 -> 代理到内部 8001 端口 -> 后端服务
```

这种架构确保了前端页面被正确提供，同时 API 请求被正确路由到后端服务。