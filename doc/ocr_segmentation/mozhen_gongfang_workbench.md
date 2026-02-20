# 墨阵·工坊 (Workbench) - 碑帖标注与切字平台设计文档

定位：本功能是「墨阵 InkGrid」产品的一部分，但不面向普通用户，仅供作者本人在 PC Web 端使用，用于把“碑帖页图 → 结构切分/识读 → 人工校对 → 导出字库数据集”的生产链路跑通并可持续迭代。

本文档用于固化上下文：后续即使对话上下文丢失，也能按本文推进实现与迭代。

---

## 1. 产品名称

建议产品名：`墨阵·工坊`（英文：`InkGrid Workbench`）

命名理由：
- 延续“墨阵”气质：偏工具、偏工艺与生产力。
- 突出内部工作台属性：不是面向大众的“展览/学习”，而是面向作者的“制作/校对/导出”。

---

## 2. 使用约束与目标

### 2.1 使用约束
- 运行环境：`localhost`。
- 鉴权：当前默认无（本地工具）。如需可后续补 token 校验。
- 端侧：必须为 PC Web 端使用（移动端不支持）。
- 任务耗时：10 分钟级可接受，因此需要后台任务（Job）+ 进度展示。

### 2.2 目标
- 上传 1~N 张碑帖页图并输入碑帖名（作为先验）。
- AI 自动进行：
  - 页级结构标注：画横竖线/切分网格，得到每个字格（cell）。
  - 单字裁切：生成每格对应的裁切框（crop）。
  - 单字识读：每格输出对应的 `繁/异体` 与 `简体`（并给候选与置信度）。
- 人工可在原图上微调：线、格子、裁切框、字符标签。
- 确认后导出：
  - 每字 PNG（方图）与 `index.json` 等完整数据集（可下载 zip）。
  - 每页“叠加标注成果图”（overlay），便于归档与复查。
- 导出产物可被墨阵未来模块直接引用。

---

## 3. 与现有 InkGrid 系统的整合方式

### 3.1 前端整合（隐藏模式）
- 继续沿用 query param 模式，不影响普通用户信息架构：
  - `/?mode=workbench`：项目/上传/任务/导出（新增）。
  - `/?mode=annotator&stele=...&dataset=...`：逐字队列与微调（复用已有 `SteleAnnotator`）。

补充：为提升可用性，也支持更直观的路径入口：
- `/workshop`（推荐入口）

### 3.2 后端整合（FastAPI）
- 在现有 `backend/app/main.py` 中追加 `/api/workbench/*`。
- `/api/workbench/*` 与 `/api/annotator/*` 当前不做 token 校验（本地工具优先跑通）。
- 数据资产继续放在 `steles/` 下，利用现有静态挂载 `/steles` 直接访问。

### 3.3 复用已有闭环
已有资产/脚本（当前仓库）：
- 单字 QA：`scripts/qa_char_crops.py` 生成 `qa_report.json` / `qa_summary.md`。
- 覆写与局部重渲染：
  - 覆写：`steles/<stele>/annotator/overrides.json`
  - 应用：`scripts/apply_crop_overrides.py`（只重渲染受影响 png + 更新 index.json）
- 逐字微调 UI：`frontend/src/components/SteleAnnotator.tsx`

Workbench 的新增部分只负责补齐“上游”：上传 → 自动结构切分/对齐/识读 → 生成 dataset，并把产物喂给现有 annotator/QA 管线。

---

## 4. 数据组织（文件化，不引入数据库）

V1 先统一放在 `unknown` 分类目录：

```
steles/unknown/<stele_slug>/
  pages_raw/
    page_01.jpg
    page_02.jpg
  workbench/
    project.json
    text_candidates.json
    alignment.json
    pages.json
    jobs/<job_id>.json
    llm_cache.json
  annotator/
    overrides.json
  chars_workbench_v1/
    index.json
    qa_report.json
    qa_summary.md
    overlays/
      page_01_grid.png
      page_01_crop.png
      page_01_qa.png
    *.png
```

说明：
- `workbench/*` 是“工程文件”，用于重复运行与迭代。
- `chars_workbench_vN` 是“产物版本”，用于墨阵引用与下载归档。

版本号策略：自动递增 `vN`，扫描同目录下已有 `chars_workbench_v*` 取最大值 + 1。

---

## 5. 核心流程（PC Web 端）

### Step A：新建项目 + 上传
- 输入碑帖名。
- 生成 `stele_slug`：拼音小写、`-` 连接、去除非字母数字；允许手动覆写避免冲突。
- 设置整项目参数（V1 足够）：
  - 阅读方向（纵向右起/横向左起/自动）。
  - 网格约束：列数（竖排）与每列字数（行数）；或横排时行数与每行字数。
- 上传并排序页图。

### Step B：一键 AI 标注（后台 Job）
任务阶段（建议 stage 名称固定，便于 UI 展示）：
1) `fetch_text`：根据碑帖名自动搜索并抓取释文候选。
2) `normalize_text`：清洗、繁简并存、生成置信度。
3) `layout`：在给定方向/列数/行数的约束下，生成列线/行线与 cell 网格。
4) `align`：把释文序列对齐到 cell 序列（DP/Viterbi）；对齐冲突记录为队列项。
5) `crop_render`：为每格生成 crop_box 并渲染 512 方图 PNG。
6) `ocr`：对单格做 OCR（在线大模型），输出候选与置信度。
7) `qa`：跑 QA 生成 `qa_report.json`。
8) `overlay`：生成每页 overlay 图。
9) `export`：固化到 `chars_workbench_vN`，并可选生成 zip。

### Step C：人工校对工作台
核心原则：队列驱动，而不是逐字遍历。

三栏布局建议：
- 左：队列（按严重程度排序：对齐冲突 > 跨格吞字/重复 > 裁断 > 低置信度）。
- 中：原图画布（叠加：列线/行线/cell_box/crop_box/字符标签），支持拖拽缩放与吸附。
- 右：当前条的输出预览（512 方图）+ 标签编辑（trad/simp）+ OCR 候选一键替换 + Apply/Re-QA。

### Step D：导出
- 导出 zip：`index.json + png + text + qa_report + overlays/`。
- overlay 分层导出：
  - grid：格线 + 标签
  - crop：裁切框
  - qa：QA 高亮

---

## 5.1 页级编辑（专业体验重点）

核心交互（鼠标优先）：
- 在 Page Editor 中直接拖拽列线/行线。
- **松手后重算预览**：触发 `preview_page` job，生成预览 overlays 与格子预览图。
- 预览满意后再运行 `export_dataset` job 固化为 `chars_workbench_vN`。

当前实现状态：
- 已支持 `preview_page` job（单页预览输出到 `workbench/preview/<page>/`）。
- 已支持把预览计算出的 layout 持久化写回 `workbench/pages.json`。
- `workbench_build_dataset.py` 会优先使用 `pages.json` 中的 layout（因此手动调线能影响最终导出）。

后续专业化迭代工作清单详见：
- `doc/workbench/workshop_requirements.md`

---

## 6. 命名规则与 index.json（墨阵可引用）

### 6.1 文件命名
统一：`<stele_id>_<global_idx:04d>_U<codepoint>.png`

示例：`lantingjixu_shenlong_0020_U862D.png`

### 6.2 index.json 字段建议
- `total_chars`
- `files[]` 每条至少包含：
  - `index`
  - `file`
  - `char_trad`（繁体/异体）
  - `char_simp`（简体）
  - `source`：
    - `image`（页图）
    - `cell_box`（结构网格）
    - `crop_box`（最终裁切）
    - `grid`（page/col/row 或 col/row）
    - `safe_column_box`、`safe_row_box`（用于防跨格吞字；v19 算法建议引入）
  - `ocr.candidates[]`（可选，但对队列与纠错很有价值）
  - `quality`（QA 指标摘要）

---

## 7. LLM Provider 方案（全局单 Provider，后续可配置切换）

### 7.1 约束
选择方案：全局只选一个 provider（B 方案）。但同一 provider 内允许配置不同 model（OCR/Text）。

支持的 provider：
- `gemini` / `gpt` / `claude` / `deepseek` / `ernie` / `glm` / `kimi` / `minimax`

### 7.2 配置（建议）
- `INKGRID_LLM_PROVIDER`：上述之一。
- `INKGRID_LLM_MODEL_TEXT`：文本任务模型。
- `INKGRID_LLM_MODEL_OCR`：带图任务模型。
- `INKGRID_LLM_TEMPERATURE`、`INKGRID_LLM_MAX_TOKENS`、`INKGRID_LLM_TIMEOUT_S`
- 各家 key/base_url（按 provider 读取；OpenAI-compatible provider 使用 `INKGRID_LLM_BASE_URL`）。

### 7.3 统一能力抽象
将 LLM 能力拆成：
- `text_json`：纯文本结构化任务（释文清洗、候选融合、对齐解释）。
- `vision_json`：带图结构化任务（单格 OCR、页级判断）。

provider 必须声明自身能力：是否支持 vision。

降级策略：若 provider 不支持 `vision_json`，OCR 阶段跳过，但 layout/align/crop/qa/overlay/export 全流程仍可完成。

### 7.4 统一输出格式
OCR（单格识读）返回 JSON：

```json
{
  "best_trad": "蘭",
  "best_simp": "兰",
  "confidence": 0.0,
  "candidates": [
    {"trad": "蘭", "simp": "兰", "score": 0.0},
    {"trad": "監", "simp": "监", "score": 0.0}
  ],
  "notes": ""
}
```

释文清洗/融合返回 JSON：

```json
{
  "text_trad": "...",
  "text_simp": "...",
  "confidence": 0.0,
  "warnings": []
}
```

可靠性：统一做 JSON 修复重试 + 缓存（image_hash + prompt_hash）。

---

## 10. 环境变量（V1）

鉴权：当前未启用（代码里不再读取 `INKGRID_ADMIN_TOKEN`）。

释文搜索（可选；不设置则需要手动粘贴释文）：
- `INKGRID_SEARCH_ENDPOINT`: HTTP 搜索接口地址，使用 query 参数 `q`。
  - 期望返回 JSON，包含 `results` 或 `items` 的列表，每项尽量包含 `title/url/snippet`。

默认行为：
- 若未配置 `INKGRID_SEARCH_ENDPOINT`，V1 会使用百度搜索（HTML 抓取，best-effort）获取候选链接，并尝试抓取前 3 个候选页面正文作为 `text_trad` 预填。

---

## 8. UI 风格与交互原则

视觉方向：科技感、现代感、深色工作台。
- 深色底 + 玻璃态卡片 + 低饱和霓虹边缘光（青蓝/青绿）
- 微动效克制但明确：stepper 阶段完成、队列 hover、保存/应用 toast、loading 状态

交互原则：
- “调线优先”：结构层修正应优先于逐字修 crop。
- 队列驱动：对齐冲突/吞字/裁断/低置信度优先处理。
- 可追溯：每次导出都形成新 vN；overlay 归档；QA 报告可回看。

---

## 9. V1 里程碑

M1（跑通）
- Workbench 新建项目/上传
- 一键 Job：fetch text → layout → align → crop/render → QA → overlay → export
- 跳转 `SteleAnnotator` 进行逐字微调

M2（好用）
- 原图画布可编辑列线/行线/格子与裁切框
- 调整后局部重算并导出新版本

M3（可交付）
- 文本对齐与字符标签纠错 UI 完整
- zip 导出包含 overlays
- 可选：注册到墨阵 catalog 引用
