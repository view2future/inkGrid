# Implementation Plan: 高精度切分原型与标注界面

## Phase 1: 环境搭建与架构初始化 [x]
- [x] Task: 搭建 FastAPI 后端基础框架
    - [x] 编写 API 路由测试
    - [x] 实现基础的服务目录结构
- [x] Task: 初始化 React 前端项目 (TypeScript + Tailwind)
    - [x] 配置基本的组件测试环境
- [x] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2: AI 核心服务开发 (TDD) [x]
- [x] Task: 集成 PaddleOCR 检测模块
    - [x] 编写测试：验证 OCR 能识别样本图像中的字符位置
    - [x] 实现 OCR 服务类
- [x] Task: 集成 SAM 分割模块
    - [x] 编写测试：验证 SAM 能根据给定 BBox 返回掩码
    - [x] 实现 SAM 分割 Service
- [x] Task: 实现字符自动命名逻辑 (Pinyin 匹配)
    - [x] 编写测试：验证汉字到拼音的转换准确性
    - [x] 实现命名 Service
- [x] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3: Web 交互界面开发 [x]
- [x] Task: 开发基于 Canvas 的交互画布组件
    - [x] 编写组件测试：模拟鼠标拖拽 BBox
    - [x] 实现画布标注功能
- [x] Task: 实现前后端 AI 任务联调 (React Query)
    - [x] 验证点击/微调后的实时预览流程
- [x] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)

## Phase 4: 导出与端到端验证 [x]
- [x] Task: 实现高精度切分图片导出接口
    - [x] 编写测试：验证导出的图像文件格式与命名
    - [x] 实现导出功能
- [x] Task: 针对《峄山碑》进行全流程跑通验证
- [x] Task: Conductor - User Manual Verification 'Phase 4' (Protocol in workflow.md)
