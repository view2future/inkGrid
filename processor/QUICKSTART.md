# InkGrid Processor - 快速启动指南

## 概述

InkGrid Processor 是一个基于 KIMI Vision API 的中国书法碑帖识别系统。相比传统的 CV/OCR 方法，使用 VLM（视觉语言模型）可以更准确地识别篆书、隶书等古文字的精确位置和内容。

## 快速开始

### 1. 环境准备

```bash
cd processor

# 激活虚拟环境
source venv/bin/activate

# 或创建新环境
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. 获取 API 密钥

1. 访问 https://platform.moonshot.cn/
2. 注册账号
3. 创建 API 密钥
4. 设置环境变量:

```bash
export KIMI_API_KEY="your-api-key-here"
```

### 3. 运行测试

```bash
# 测试知识库
python example_usage.py

# 运行完整测试（需要 API 密钥）
python test_vlm.py
```

### 4. 分析单张图片

```bash
python run_analysis.py analyze \
    --image ../steles/1-zhuanshu/1-yishankeshi/yishan.jpg \
    --name "峄山刻石" \
    --script "小篆" \
    --output result.json
```

### 5. 启动 API 服务

```bash
# 终端 1: 启动 Redis
redis-server

# 终端 2: 启动 Celery Worker
celery -A celery_app worker --loglevel=info

# 终端 3: 启动 FastAPI 服务
uvicorn main:app --reload
```

访问 http://localhost:8000/docs 查看 API 文档。

## 核心功能

### 1. 高精度字符识别

- 使用 KIMI VLM 进行像素级字符定位
- 支持篆书、隶书、楷书等多种书体
- 输出包含原文、简体字、拼音、释义的完整信息

### 2. 智能行列分析

- 自动识别传统阅读顺序（从上到下、从右到左）
- 输出每个字符的行列位置
- 支持归一化坐标到像素坐标的转换

### 3. 批量处理

- 支持文件夹批量处理
- 异步任务队列（Celery + Redis）
- 进度回调和错误重试

### 4. 区域重识别

- 支持框选特定区域重新分析
- 适用于字符识别不准确的局部优化

## 输出格式

```json
{
  "tablet_id": "峄山刻石",
  "info": {
    "name": "峄山刻石",
    "script_type": "小篆",
    "layout": "Vertical",
    "total_characters": 135
  },
  "characters": [
    {
      "index": 1,
      "char": "皇",
      "original": "皇",
      "bbox": [50, 100, 80, 30],
      "pinyin": "huáng",
      "definition": "皇帝，君主",
      "row": 1,
      "col": 1
    }
  ]
}
```

## 内置碑帖

系统内置以下碑帖的真值数据：

| 碑帖名称 | 书体 | 字数 | 朝代 |
|---------|------|------|------|
| 峄山刻石 | 小篆 | 135 | 秦 |
| 曹全碑 | 隶书 | 849 | 东汉 |
| 峄山刻石全文 | 小篆 | 222 | 秦 |

## API 端点

### 单图分析

```bash
curl -X POST "http://localhost:8000/v1/tasks/segment" \
    -F "file=@yishan.jpg" \
    -F "stele_name=峄山刻石" \
    -F "script_type=小篆"
```

### 区域分析

```bash
curl -X POST "http://localhost:8000/v1/tasks/region" \
    -F "file=@yishan.jpg" \
    -F 'region={"x":100,"y":200,"width":300,"height":400}' \
    -F "stele_name=峄山刻石"
```

### 批量处理

```bash
curl -X POST "http://localhost:8000/v1/tasks/batch" \
    -F "files=@page1.jpg" \
    -F "files=@page2.jpg" \
    -F 'metadata=[{"stele_name":"页面1"},{"stele_name":"页面2"}]'
```

## 配置选项

通过环境变量配置：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `KIMI_API_KEY` | API 密钥 | 必填 |
| `KIMI_BASE_URL` | API 地址 | https://api.moonshot.cn/v1 |
| `KIMI_MODEL` | 模型名称 | moonshot-v1-8k-vision-preview |
| `REDIS_URL` | Redis 地址 | redis://localhost:6379/0 |

## 文件结构

```
processor/
├── core/               # 核心模块
│   ├── vlm_client.py  # KIMI API 客户端
│   ├── prompts.py     # VLM 提示词
│   ├── inference.py   # 推理逻辑
│   ├── models.py      # 数据模型
│   └── knowledge.py   # 碑帖知识库
├── celery_app.py      # 异步任务
├── main.py            # FastAPI 服务
├── run_analysis.py    # 命令行工具
├── test_vlm.py        # 测试脚本
├── example_usage.py   # 使用示例
├── README.md          # 详细文档
└── QUICKSTART.md      # 本文件
```

## 常见问题

### Q: 识别准确率如何？

A: 对于清晰图像，配合真值数据，准确率可达 95%+。对于模糊或损坏字符，系统会标记为 "□"。

### Q: 支持哪些图像格式？

A: JPG, PNG, WebP。

### Q: 如何处理大批量图片？

A: 使用批量处理 API 或命令行工具，配合 Celery 队列进行异步处理。

### Q: API 调用失败怎么办？

A: 系统内置重试机制，最多重试 3 次。如仍失败，请检查 API 密钥和网络连接。

## 下一步

1. 阅读完整文档: [README.md](README.md)
2. 查看使用示例: `python example_usage.py`
3. 运行完整测试: `python test_vlm.py`
4. 探索 API 文档: http://localhost:8000/docs
