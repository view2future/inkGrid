# InkGrid Processor - VLM Edition

使用 KIMI Vision API 进行中国书法碑帖智能识别与切分。

## 功能特性

- **高精度识别**: 使用 KIMI VLM 进行像素级字符定位
- **多书体支持**: 支持篆书、隶书、楷书等多种书体
- **智能切分**: 自动识别行列布局，按传统阅读顺序输出
- **批量处理**: 支持批量处理多张图片
- **区域重识别**: 支持对局部区域进行精细化重新识别
- **知识库支持**: 内置著名碑帖真值数据（峄山刻石、曹全碑等）

## 快速开始

### 1. 安装依赖

```bash
cd processor
pip install -r requirements.txt
```

### 2. 配置 API 密钥

```bash
export KIMI_API_KEY="your-api-key-here"
```

获取 API 密钥: https://platform.moonshot.cn/

### 3. 运行测试

```bash
# 分析单张图片
python run_analysis.py analyze \
    --image ../steles/1-zhuanshu/1-yishankeshi/yishan.jpg \
    --name "峄山刻石" \
    --script "小篆" \
    --output result.json

# 查看可用碑帖
python run_analysis.py list

# 批量处理
python run_analysis.py batch \
    --batch ../steles/1-zhuanshu/1-yishankeshi/ \
    --script "小篆" \
    --output batch_results.json
```

### 4. 启动 API 服务

```bash
# 启动 Redis (用于任务队列)
redis-server

# 启动 Celery Worker
celery -A celery_app worker --loglevel=info

# 启动 FastAPI 服务
uvicorn main:app --reload
```

API 文档: http://localhost:8000/docs

## API 使用示例

### 单图分析

```bash
curl -X POST "http://localhost:8000/v1/tasks/segment" \
    -F "file=@yishan.jpg" \
    -F "stele_name=峄山刻石" \
    -F "script_type=小篆"
```

返回:
```json
{
  "task_id": "abc-123",
  "status": "submitted",
  "message": "Task processing in background"
}
```

### 查询任务状态

```bash
curl "http://localhost:8000/v1/tasks/abc-123"
```

### 区域重识别

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
    -F 'metadata=[{"stele_name":"峄山-1","script_type":"小篆"},{"stele_name":"峄山-2","script_type":"小篆"}]'
```

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
  "image_dimensions": {
    "width": 800,
    "height": 1200
  },
  "characters": [
    {
      "index": 1,
      "char": "皇",
      "original": "皇",
      "bbox": [50, 100, 80, 120],
      "pinyin": "huáng",
      "definition": "皇帝，君主",
      "row": 1,
      "col": 1
    }
  ],
  "total_detected": 135
}
```

## 坐标系统

- **bbox**: `[x, y, width, height]` 像素坐标
- **row**: 列号（从右到左，1 = 最右列）
- **col**: 行号（从上到下，1 = 最上行）
- **index**: 阅读顺序索引（从上到下、从右到左）

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `KIMI_API_KEY` | KIMI API 密钥 | 必填 |
| `KIMI_BASE_URL` | API 基础地址 | https://api.moonshot.cn/v1 |
| `KIMI_MODEL` | 使用的模型 | moonshot-v1-8k-vision-preview |
| `REDIS_URL` | Redis 连接地址 | redis://localhost:6379/0 |

## 模型说明

默认使用 `moonshot-v1-8k-vision-preview` 模型，支持：

- 图像理解与分析
- JSON 结构化输出
- 中文字符精确识别

如需使用其他模型，可设置 `KIMI_MODEL` 环境变量。

## 性能优化

1. **图像预处理**: 自动压缩大尺寸图像以减少 Token 消耗
2. **批处理**: 使用 Celery 队列进行异步批量处理
3. **重试机制**: API 调用失败时自动重试
4. **缓存**: 支持真值数据缓存，提高识别准确度

## 常见问题

### Q: 如何获取 KIMI API 密钥？
A: 访问 https://platform.moonshot.cn/ 注册并创建 API 密钥。

### Q: 支持哪些图像格式？
A: JPG, PNG, WebP 格式均支持。

### Q: 识别准确率如何？
A: 对于清晰碑帖图像，配合真值数据，准确率可达 95%+。

### Q: 如何处理识别错误的字符？
A: 使用区域重识别功能，框选错误区域进行重新分析。

## 项目结构

```
processor/
├── core/
│   ├── vlm_client.py    # KIMI API 客户端
│   ├── prompts.py       # VLM 提示词
│   ├── inference.py     # 推理逻辑
│   ├── models.py        # 数据模型
│   └── knowledge.py     # 碑帖知识库
├── celery_app.py        # 异步任务队列
├── main.py              # FastAPI 服务
├── run_analysis.py      # 命令行工具
└── test_vlm.py          # 测试脚本
```

## License

MIT License
