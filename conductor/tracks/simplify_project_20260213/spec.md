# 任务规范：项目瘦身与功能简化

## 1. 概览 (Overview)
本任务旨在简化 `inkGrid` 项目，移除所有与 OCR（光学字符识别）、PaddlePaddle、CV（计算机视觉）相关的冗余模型、库及功能逻辑。项目将转型为以“前端展示”为核心的简约系统，保留核心的艺术欣赏功能。

## 2. 核心功能保留 (Scope of Retention)
* **首页 (Home)**：品牌展示。
* **墨廊 (Gallery)**：碑帖列表展示。
* **峄山刻石欣赏 (Yishan Appreciation)**：单体碑帖的深度交互。
* **墨流 (InkFlow)**：流式文字与碑帖卡片欣赏。
* **极简后端**：保留基础 Python 服务，仅用于提供静态 JSON 数据和碑帖/字形图片。

## 3. 移除内容 (Scope of Removal)
* **模型与库**：移除 `requirements.txt` 中所有与 `paddlepaddle`, `opencv-python`, `torch`, `segment-anything` 等相关的 OCR/CV 库。
* **后端冗余功能**：
    * 移除 `Celery` 和 `Redis` 异步任务系统及相关配置。
    * 移除图片上传 (`uploads`) 接口及本地上传目录。
    * 移除所有 OCR 标注、识别、分割的算法逻辑代码。
* **部署与环境**：移除 Docker 相关的部署脚本。
* **物理文件清理**：清理项目根目录下的 `inkGrid_backup`, `inkGrid_clean_backup`, `inkGrid_clean` 等历史备份目录。

## 4. 验收标准 (Acceptance Criteria)
* 首页、墨廊、峄山刻石、墨流功能在前端运行正常，数据加载无误。
* 后端启动不再加载 Paddle/OCR 相关的模型文件。
* `requirements.txt` 不再包含 CV/OCR 相关库。
* `inkGrid_backup` 等备份文件夹已从磁盘删除。
* 后端不再监听 Redis/Celery 端口。
