# inkGrid - 前端页面显示问题排查

## 问题描述
当前部署后，访问首页显示 "墨阵 InkGrid Backend is Running (Lean Version)"，而不是期望的首页界面。

## 问题分析
这个问题通常是由于以下几个原因之一造成的：

1. **前端构建产物未正确生成**：Docker 构建过程中前端没有正确构建
2. **Nginx 配置问题**：Nginx 没有正确地将所有路由指向前端
3. **API 代理配置问题**：API 请求没有正确代理到后端

## 解决方案

### 1. 确认前端构建
确保前端代码能够正确构建：
```bash
cd frontend
npm run build
```

### 2. 验证 Nginx 配置
当前的 Nginx 配置应该将所有非 API 请求指向 index.html：
```
location / {
    root /usr/share/nginx/html;
    try_files $uri $uri/ /index.html;
}
```

### 3. API 代理配置
确保 API 请求（以 /api/ 开头）被正确代理到后端服务：
```
location /api/ {
    proxy_pass http://127.0.0.1:8001/api/;
    # ... 其他代理配置
}
```

### 4. 检查端口配置
确保应用监听正确的端口，Zeabur 会设置 $PORT 环境变量。

## Dockerfile 优化建议

如果上述配置仍不能解决问题，可以尝试以下优化：

1. 确保前端构建成功
2. 验证构建产物包含 index.html
3. 确保 Nginx 配置正确
4. 检查后端服务是否在内部端口 8001 上运行

## 预期行为

部署成功后，访问根路径 (`/`) 应该显示：
- 首页包含 5 个篆体字轮转
- 左下角有墨廊入口
- 右下角有峄山刻石赏析入口
- 所有前端交互功能正常

API 请求（如 `/api/steles`）应该被代理到后端服务。

## 调试步骤

1. 检查构建日志，确认前端构建成功
2. 验证 Nginx 是否正确启动
3. 确认后端服务是否在内部端口运行
4. 检查是否有任何 JavaScript 错误影响前端渲染