# 墨梯 InkLadder - 书法考级题库系统

> 墨阵 InkGrid 子模块 - 书法考级出题与学习平台

---

## 📋 产品概述

**墨梯 InkLadder** 是墨阵 InkGrid 的考级题库子模块，为书法学习者提供系统化的考级训练内容。

### 核心定位
- **只出题，不评分** - 专注于题目展示和学习引导
- **线下练习** - 书写练习在线下完成
- **本地存储** - 学习进度保存在浏览器本地

### 等级体系
| 等级 | 名称 | 目标用户 |
|------|------|----------|
| 4-6 级 | 中级 | 掌握一种主要书体，能背临经典碑帖 |
| 7-8 级 | 高级 | 精通一种书体，兼善其他，创作能力强 |

---

## 🏗️ 技术架构

### 前端组件结构
```
frontend/src/
├── components/grade/
│   ├── GradeHome.tsx          # 等级选择首页
│   ├── QuestionBrowser.tsx    # 题库浏览
│   ├── ImitationQuestion.tsx  # 临摹题展示
│   ├── CreationQuestion.tsx   # 创作题展示
│   ├── TheoryQuiz.tsx         # 理论答题
│   └── ExamPaper.tsx          # 模拟考试
│
├── data/grade-questions/
│   ├── level-4-6.json         # 4-6 级题库
│   ├── level-7-8.json         # 7-8 级题库
│   └── theory-bank.json       # 理论题库
│
├── types/
│   └── grade.ts               # 类型定义
│
└── utils/
    └── gradeStorage.ts        # 本地存储工具
```

### 路由方案
采用 URLSearchParams 模式，与现有 Workbench 保持一致：

| 模式 | URL | 说明 |
|------|-----|------|
| 墨梯首页 | `?mode=grade` | 等级选择页面 |
| 中级题库 | `?mode=grade#/intermediate` | 4-6 级题目 |
| 高级题库 | `?mode=grade#/advanced` | 7-8 级题目 |
| 理论答题 | `?mode=grade#/theory` | 理论练习 |
| 模拟考试 | `?mode=grade#/exam` | 模拟测试 |

---

## 📚 题库内容

### 4-6 级（中级）

#### 临摹题 (6 道)
- 楷书：《多宝塔碑》《九成宫醴泉铭》《玄秘塔碑》
- 隶书：《曹全碑》《张迁碑》
- 行书：《兰亭序》

#### 创作题 (6 道)
- 五言绝句：2 首
- 七言绝句：2 首
- 经典名句：2 则

#### 理论题 (9 道)
- 选择题、填空题
- 涵盖书体知识、名家名作

### 7-8 级（高级）

#### 临摹题 (8 道)
- 楷书：《多宝塔碑》《九成宫》《雁塔圣教序》
- 隶书：《曹全碑》《礼器碑》
- 篆书：《峄山碑》
- 行草：《书谱》《兰亭序》

#### 创作题 (9 道)
- 五/七言绝句：2 首
- 七言律诗：2 首
- 宋词：1 首
- 古文节选：2 则
- 经典名句：2 则

#### 理论题 (12 道)
- 书法史、书体知识、名家名作、文房四宝、书法美学

---

## 🎯 功能模块

### 1. 等级选择 (GradeHome)
- 中级/高级卡片入口
- 学习进度统计（已学题目、理论答题、模拟考试、连续学习天数）
- 快速入口（临摹、创作、理论、模考）

### 2. 题库浏览 (QuestionBrowser)
- 按类型筛选（临摹/创作）
- 按书体筛选（楷/隶/篆/行/草）
- 题目卡片展示（内容、要求、分值、时间）
- 收藏功能

### 3. 临摹题详情 (ImitationQuestion)
- 原帖图片展示（可缩放）
- 临摹内容（大字显示）
- 评分要求
- 练习提示
- 标记已学习

### 4. 创作题详情 (CreationQuestion)
- 创作内容（诗词/名句）
- 推荐格式（条幅/横幅/中堂/斗方/对联）
- 章法建议
- 落款规范
- 标记已学习

### 5. 理论答题 (TheoryQuiz)
- 分类练习（书法史/书体知识/名家名作/文房四宝/书法美学）
- 混合练习
- 选择题/填空题
- 即时反馈（正确/错误 + 解析）
- 得分统计

### 6. 模拟考试 (ExamPaper)
- 完整试卷结构
- 计时器（4-6 级 120 分钟 / 7-8 级 150 分钟）
- 三部分：临摹、创作、理论
- 理论题自动判分
- 临摹/创作自评（百分比）
- 成绩报告

---

## 💾 数据存储

### LocalStorage 结构
```typescript
interface LearningProgress {
  lastVisit: string;                      // 最后访问时间
  completedQuestions: string[];           // 已学习题目 ID
  theoryScores: Record<string, number>;   // 理论题得分
  examHistory: ExamRecord[];              // 考试历史
  bookmarks: string[];                    // 收藏题目
  studyStreak: number;                    // 连续学习天数
}
```

### 存储键名
- `inkLadder_progress_v1`

---

## 🚀 使用方法

### 访问墨梯
```
http://localhost:5173/?mode=grade
```

### 直接访问特定页面
```
# 中级题库
http://localhost:5173/?mode=grade#/intermediate

# 高级题库
http://localhost:5173/?mode=grade#/advanced

# 理论答题
http://localhost:5173/?mode=grade#/theory

# 模拟考试
http://localhost:5173/?mode=grade#/exam/intermediate
http://localhost:5173/?mode=grade#/exam/advanced
```

---

## 🎨 UI 设计风格

### 配色方案
- 背景：深色渐变 (`#1a1a1a` → `#000000`)
- 卡片：`zinc-800/30` + 毛玻璃效果
- 强调色：
  - 琥珀色 (`amber-500`) - 主要操作
  - 翠绿色 (`emerald-500`) - 墨梯入口/完成状态
  - 红色 (`red-500`) - 交卷/错误

### 视觉元素
- 圆角卡片 (`rounded-xl`, `rounded-2xl`)
- 渐变边框
- 毛玻璃效果 (`backdrop-blur`)
- 图标表情符号（📖 ✍️ 📝 🎓）

---

## 📊 数据统计

### 学习统计指标
- 已学题目数
- 理论答题数
- 模拟考试次数
- 平均理论得分
- 平均考试得分
- 连续学习天数
- 收藏题目数

---

## 🔧 扩展与维护

### 添加新题目
1. 在对应的 JSON 文件中添加题目数据
2. 确保 ID 唯一
3. 遵循类型定义

### 修改评分标准
- 临摹/创作题：修改 `score` 和 `requirements`
- 理论题：修改 `score` 和 `explanation`

### 新增等级
1. 创建新的 JSON 数据文件
2. 在 `GradeHome.tsx` 中添加等级卡片
3. 更新路由逻辑

---

## 📝 开发清单

- [x] 题库 JSON 数据结构
- [x] 本地存储工具
- [x] 等级选择首页
- [x] 题库浏览组件
- [x] 临摹题展示
- [x] 创作题展示
- [x] 理论答题
- [x] 模拟考试
- [x] 路由配置
- [x] 主导航入口

---

## 🎯 后续优化建议

1. **题目搜索** - 按书体/字数/难度筛选
2. **错题本** - 自动收集理论错题
3. **学习提醒** - 每日学习通知
4. **成就系统** - 学习里程碑徽章
5. **分享功能** - 生成学习海报
6. **AI 推荐** - 根据水平推荐题目

---

*墨梯 InkLadder · 墨阵 InkGrid 子模块*

*最后更新：2026 年 2 月*
