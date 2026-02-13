# Implementation Plan: Track 1 - 高精标注台底座

## Phase 1: 渲染引擎与基础架构 [x]
- [x] Task: 更新前端依赖并安装 PixiJS 与 Paper.js
- [x] Task: 构建基于 PixiJS 的超高清图像查看器组件
    - [x] 编写测试：验证大图加载逻辑
    - [x] 实现平滑缩放与平移 (Viewport)
- [x] Task: 集成 i18next 实现中英双语切换
- [x] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2: 矢量标注核心开发 [x]
- [x] Task: 开发基于 Paper.js 的 Bézier 标注层
    - [x] 编写测试：验证路径创建与控制点计算
    - [x] 实现画笔工具：支持勾勒闭合路径
    - [x] 实现节点编辑工具：支持拖拽锚点和控制柄
- [x] Task: 实现标注数据的序列化与反序列化 (JSON)
- [x] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3: 美学 UI 与端到端集成
- [ ] Task: 构建“赛博金石”风格的操作面板
- [ ] Task: 实现《峄山碑》样例数据的加载与保存流程
- [ ] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)
