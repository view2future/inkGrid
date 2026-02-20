# 修复 404 错误 - 兰亭序字库文件

## 问题

```
GET http://localhost:5173/steles/4-xingshu/1-lantingjixu/lanting-HCCG-CycleGAN/index.json 404 (Not Found)
```

## 原因

Vite 开发服务器的代理配置将 `/steles` 请求转发到了后端 FastAPI 服务器（端口 8000），但后端服务器没有运行。

## 解决方案

### 方案 1：重启开发服务器（推荐）

已更新 `vite.config.ts`，移除了 `/steles` 的代理配置。现在 Vite 会直接从 `public` 目录提供文件。

**需要重启开发服务器：**

```bash
cd /Users/wangyu94/caligraph_practice/inkGrid/frontend

# 停止当前运行的开发服务器（Ctrl+C）

# 重新启动
npm run dev
```

### 方案 2：启动后端服务器

如果需要后端服务器提供 `/steles` 文件：

```bash
cd /Users/wangyu94/caligraph_practice/inkGrid/backend
python -m uvicorn app.main:app --reload --port 8000
```

## 验证

重启开发服务器后，访问以下 URL 验证：

```
http://localhost:5173/steles/4-xingshu/1-lantingjixu/lanting-HCCG-CycleGAN/index.json
```

应该能看到 JSON 数据。

## 文件位置

```
frontend/public/steles/4-xingshu/1-lantingjixu/lanting-HCCG-CycleGAN/
├── index.json          ✅ 存在
├── text.txt            ✅ 存在
├── analysis.json       ✅ 存在
├── 0001.jpg            ✅ 存在
├── 0002.jpg            ✅ 存在
└── ...
```

## 注意事项

- 修改了 `vite.config.ts` 后必须重启开发服务器
- Vite 默认会提供 `public` 目录中的所有静态文件
- 只有 `/api` 请求会被代理到后端服务器
