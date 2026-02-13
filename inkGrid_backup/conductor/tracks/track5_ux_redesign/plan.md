# Implementation Plan: Track 5 - UX 重构

## Phase 1: 视觉地基 (Foundation)
- [ ] **全局样式更新**: 修改 `tailwind.config.js`，定义“金石琥珀”色彩体系及字体族。
- [ ] **主框架布局重构**: 废弃现有的 flex 杂烩，改用 `CSS Grid` 划定核心区域。
- [ ] **Canvas 容器封装**: 编写 `CanvasContainer` 组件，确保 PixiJS 视口始终居中且响应式。

## Phase 2: 信息架构优化 (Readability)
- [ ] **右侧工作台重构**: 
    - 实现大号衬线字体单字预览。
    - 优化中英双语信息卡片的布局与间距（1.6x 行高）。
- [ ] **左侧列表卡片化**: 将全文列表改为精致的卡片流。

## Phase 3: 阶段化流转 (Phased Flow)
- [ ] **状态机引入**: 在 `App.tsx` 中引入 `appPhase` 状态（ID | GRID | ALIGN | EXPORT）。
- [ ] **模式化渲染**: 根据不同阶段隐藏/显示 UI 元素。

## Phase 4: 细节润色 (Polishing)
- [ ] **动画过渡**: 使用 `framer-motion` 为阶段切换增加平滑过渡。
- [ ] **交互反馈**: 增加网格吸附的视觉反馈。
