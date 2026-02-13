# InkGrid (墨阵) - 技术栈定义

## 1. 前端交互层 (The Matrix UI)
- **框架**: React (TypeScript) + Vite
- **2D/3D 渲染引擎**: **PixiJS** (用于超高清图像与水墨特效)
- **矢量计算引擎**: **Paper.js** (核心标注逻辑：Bézier 拟合、节点管理)
- **多语言与样式**: i18next + Tailwind CSS (v4)

## 2. 后端服务层
- **Web 服务**: FastAPI (Python) - 极简 API 用于分发 JSON 数据与静态资源
- **图像处理**: Pillow (基础图像操作)

## 3. 部署架构
- **Web 部署**: 静态前端托管 + 极简后端服务
- **移动端**: 响应式 Web 适配 (Mobile First 交互设计)
