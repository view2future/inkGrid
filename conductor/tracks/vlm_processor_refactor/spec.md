# Track Specification: inkGrid-Processor 重构 (大模型驱动版 v2.0)

## 1. 概述 (Overview)
本 Track 旨在借鉴 `view2future/inkGrid` 的成功经验，利用 Google Gemini 2.0 等多模态大模型 (VLM) 彻底重构墨阵的后端识别逻辑。通过提示词工程 (Prompt Engineering) 实现对碑帖（特别是篆书、隶书）的像素级精准切片、客观字数统计及深度语义标注。

## 2. 核心目标 (Goals)
*   **高精度切分**：实现 100% 符合碑文事实的字数识别与单字坐标提取。
*   **全维度标注**：一键生成包含原文（篆隶）、对译（简体）、拼音、释义、行列逻辑在内的结构化数据。
*   **架构重构**：将 `processor` 改造为轻量级 API 网关，专注于大模型调用、数据持久化与任务调度。

## 3. 功能需求 (Functional Requirements)

### 3.1 墨核 VLM 网关 (InkCore VLM Gateway)
*   **API 集成**：支持调用 Google Gemini 2.0 Pro/Flash 多模态 API。
*   **提示词模板**：内置针对中国书法场景优化的 System Prompt，确保模型输出稳定的 JSON 格式数据。
*   **坐标转换**：将大模型返回的归一化坐标转换为对应原始图像的像素级坐标。

### 3.2 智能处理工作流
*   **全图自动处理**：支持单张图片及文件夹批量识别。
*   **局部精确增强**：支持用户框选特定区域（或某张切分不佳的图）进行二次深度识别。
*   **客观字数校验**：利用大模型输出的行列逻辑（Layout logic）与识别出的总字数进行交叉校验。

### 3.3 数据存储与管理
*   **JSON 沉淀**：将 VLM 返回的所有标注信息存储在本地数据库（PostgreSQL/MongoDB）中。
*   **切片直出**：直接基于 VLM 坐标进行物理切片，支持透明背景单字导出。

## 4. 技术栈 (Tech Stack)
*   **后端框架**：Python 3.11 + FastAPI。
*   **大模型引擎**：Google Gemini 2.0 SDK (Generative AI)。
*   **任务处理**：Celery + Redis（用于大批量异步任务排队）。
*   **图像处理**：Pillow (轻量级切割与坐标转换)。

## 5. 验收标准 (Acceptance Criteria)
*   [ ] `processor` 能够通过 API 成功调用 Gemini 2.0 并获取 JSON 数据。
*   [ ] **字数准确率**：针对《峄山碑》等标准名帖，切出的总字数需与碑文事实完全一致。
*   [ ] **书体转换**：小篆、隶书的对译准确率达到 95% 以上。
*   [ ] **批量处理**：系统能够稳定处理包含 100+ 张图片的文件夹。

## 6. 非功能性需求 (Non-Functional Requirements)
*   **响应性能**：单张切片任务的 API 往返时间受限于模型推理速度，需提供进度回调。
*   **成本控制**：通过优化图片尺寸（Downsampling）降低 Token 消耗，但不影响识别精度。
