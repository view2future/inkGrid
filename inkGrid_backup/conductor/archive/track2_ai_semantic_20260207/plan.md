# Implementation Plan: Track 2 - AI 语义辅助

## Phase 1: AI 引擎集成与后端优化 [x]
- [x] Task: 优化后端 AI Service 结构
    - [x] 确保 SAM 服务支持多点提示
    - [x] 确保 OCR 服务支持行列逻辑排序
- [x] Task: 构建《金石文库》基础 JSON 数据库
    - [x] 录入《峄山碑》全文真值
- [x] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2: 语义自动对齐逻辑开发 [x]
- [x] Task: 实现图像坐标与碑文流的对齐算法
    - [x] 编写测试：验证坐标到文字的映射准确性
    - [x] 实现基于位序的自动匹配逻辑
- [x] Task: 开发单字元数据聚合接口
- [x] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3: 前端 AI 交互集成
- [ ] Task: 实现“一键识别”交互流程
    - [ ] 集成后端对齐接口，前端自动显示预测标签
- [ ] Task: 实现基于 SAM 的点击磁吸标注
    - [ ] 验证返回的轮廓点自动转化为 Paper.js 路径
- [ ] Task: 完善结构化资产导出功能
- [ ] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)
