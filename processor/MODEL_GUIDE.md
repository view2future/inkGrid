# KIMI VLM 模型选择指南

## 可用模型对比

| 模型 | 上下文 | 图像 | 视频 | 推理 | 温度 | 速度 | 适用场景 |
|------|--------|------|------|------|------|------|----------|
| **kimi-k2.5** | 256K | ✅ | ✅ | ✅ | 必须为 1 | 慢 | 复杂推理、长文档 |
| **kimi-k2-thinking-turbo-preview** | 256K | ✅ | ❌ | ✅ | 1 | 中等 | 需要思考的视觉任务 |
| **moonshot-v1-128k-vision-preview** ⭐ | 128K | ✅ | ❌ | ❌ | 可调 | 快 | **碑帖识别推荐** |
| moonshot-v1-32k-vision-preview | 32K | ✅ | ❌ | ❌ | 可调 | 快 | 中等长度任务 |
| moonshot-v1-8k-vision-preview | 8K | ✅ | ❌ | ❌ | 可调 | 最快 | 快速测试 |

## 推荐配置

### 1. 碑帖识别生产环境（推荐）
```bash
export KIMI_MODEL="moonshot-v1-128k-vision-preview"
```
- ✅ 支持大图像输入
- ✅ 128K 上下文足够输出完整 JSON
- ✅ 响应速度快
- ✅ 温度可调（默认 0.1，输出更稳定）

### 2. 复杂碑帖分析（需要推理）
```bash
export KIMI_MODEL="kimi-k2-thinking-turbo-preview"
```
- ✅ 支持视觉 + 推理
- ✅ 适合处理损坏严重的碑帖
- ⚠️ 速度较慢

### 3. 最高级多模态（不推荐用于简单切分）
```bash
export KIMI_MODEL="kimi-k2.5"
```
- ✅ 最强能力，支持视频
- ✅ 256K 上下文
- ⚠️ 温度必须为 1（输出不稳定）
- ⚠️ 响应速度很慢
- ⚠️ 成本高

## 当前配置

```bash
# 查看当前配置
echo $KIMI_MODEL

# 推荐设置（已配置）
export KIMI_MODEL="moonshot-v1-128k-vision-preview"
```

## 测试各模型

```python
# 快速测试
python -c "
import os
os.environ['KIMI_MODEL'] = 'moonshot-v1-128k-vision-preview'
from core.vlm_client import VLMClient
client = VLMClient()
print(client.model)
"
```

## 建议

对于碑帖字符切分任务，**moonshot-v1-128k-vision-preview** 已经足够强大：
- 能准确识别篆书、隶书等古文字
- 能输出精确的 bbox 坐标
- 响应速度快，适合批量处理
- 成本较低

除非需要处理极度损坏的碑帖或需要复杂的推理分析，否则不需要使用 K2.5。
