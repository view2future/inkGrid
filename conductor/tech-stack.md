# InkGrid (墨阵) - 技术栈定义

## 1. 前端交互层 (The Matrix UI)
- **框架**: React (TypeScript) + Vite
- **2D/3D 渲染引擎**: **PixiJS** (用于超高清图像与水墨特效)
- **矢量计算引擎**: **Paper.js** (核心标注逻辑：Bézier 拟合、节点管理)
- **多语言与样式**: i18next + Tailwind CSS (v4)

## 2. 后端算力层 (The Intelligence Core)
- **Web 服务**: FastAPI (Python)
- **微服务架构**: 
  - **InkGrid Processor**: 独立图像处理微服务 (FastAPI + Celery + Redis)
  - **核心算法**: OpenCV (投影分析/去噪), NumPy
- **AI 引擎**: 
  - **PaddleOCR**: 用于碑文全图定位与语义对齐初识。
  - **SAM (Segment Anything)**: 用于像素级笔画边缘细化。
- **数据库**: PostgreSQL (空间坐标存储) + MongoDB (灵活元数据)

## 3. 部署架构
- **桌面端**: Electron (支持本地超大图像处理)
- **移动端**: 响应式 Web + WebXR (AR 互动原型)
