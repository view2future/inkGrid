# React & TypeScript 代码规范指南

## 1. 组件与逻辑
- **函数式组件**: 统一使用函数式组件 (Functional Components) 与 Hooks。
- **自定义 Hooks**: 复杂的交互逻辑（如 Canvas 上的边界框计算）应封装在自定义 Hooks 中，实现逻辑与视图分离。

## 2. TypeScript 严格模式
- 启用 `strict` 模式。
- 严禁使用 `any` 类型，必须为坐标、尺寸、API 返回值定义精确的 `Interface`。

## 3. UI 与交互
- **响应式交互**: Canvas 操作必须考虑不同屏幕缩放倍率，确保坐标对齐。
- **原子化 CSS**: 使用 Tailwind CSS 进行样式开发，保持代码整洁。
- **异步处理**: 使用 React Query 统一管理后端 AI 处理任务的状态。
