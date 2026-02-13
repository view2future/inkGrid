# Implementation Plan: Track 4 - 栅格化分割与知识库构建

## Phase 1: 栅格检测与交互 (Grid Detection & Interaction)
- [x] **算法开发**: 编写基于 OpenCV 的投影分析法（Projection Profile）或 Hough 变换的网格线识别脚本。
- [x] **前端实现**: 在 PixiJS 渲染器中添加 GridLayer，支持绘制可拖动的横竖线。
- [x] **容错设计**: 实现格子的“增加/删除/合并”交互，应对碑帖残损。

## Phase 2: OCR 与文本对齐 (OCR & Text Alignment)
- [ ] **OCR 集成**: 调研并集成更高精度的 OCR 服务（如 Google Vision 或百度 OCR 专门的书法模型）。
- [x] **对齐算法**: 实现基于 LCS (最长公共子序列) 的碑帖文字与字库真值对齐逻辑。
- [x] **局部匹配**: 开发支持用户选择“起始字”并在全文中定位当前图片位置的功能。

## Phase 3: 导出与存储 (Export & Storage)
- [x] **后端切片服务**: 实现基于网格坐标的图像裁剪与重采样。
- [x] **命名流水线**: 结合对齐结果，生成符合规范的文件名。
- [ ] **数据库建模**: 设计 `Steles`, `Characters`, `Dictionaries` 表结构。

## Phase 4: 知识检索与展示 (Search & Knowledge Display)
- [ ] **检索 UI**: 实现多功能搜索栏。
- [ ] **详情展示**: 开发包含拼音、释义、对比字形的单字详情页。
- [ ] **(Bonus) 笔顺动画**: 集成汉字笔顺数据（如 Hanzi Writer 数据集）并与单字关联。

## 待办事项 (Immediate Tasks)
1.  [ ] 在 `backend/` 下新建 `grid_segmentation` 服务。
2.  [ ] 在 `frontend/` 中更新 `PixiRenderer` 以支持网格编辑。
3.  [ ] 初始化知识库数据库结构。
