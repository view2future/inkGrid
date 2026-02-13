# 峄山刻石 图片资源库

## 📋 资源概览

| 项目 | 内容 |
|:---:|:---|
| **碑帖名称** | 峄山刻石 |
| **书体** | 小篆 |
| **朝代** | 秦 |
| **作者** | 李斯（传）|
| **标准全文** | 222字 |
| **已提取单字** | 142字 |
| **不重复字** | 118字 |

---

## 🖼️ 图片资源

### 1. 原碑完整图

**文件**: `steles/1-zhuanshu/1-yishankeshi/yishan.jpg`
- **尺寸**: 488 × 929 像素
- **格式**: JPEG
- **说明**: 峄山刻石原碑拓片完整图像

### 2. 处理后图像

| 文件名 | 说明 |
|:---|:---|
| `yishan_segmented.jpg` | 分割处理后的图像 |
| `yishan_paddle.jpg` | PaddleOCR检测结果可视化 |
| `yishan_paddle_gt.jpg` | 标注了真值的图像 |
| `visualization.jpg` | 带编号标注的可视化图像 |

### 3. 单字图片 (143张)

**存储位置**: `test_output/峄山刻石/`

**命名格式**: 
```
峄山刻石_char_{序号:03d}_r{行号:02d}_c{列号:02d}_{汉字}.jpg
```

**示例**:
- `峄山刻石_char_001_r01_c01_皇.jpg` - 第1行第1列 "皇"字
- `峄山刻石_char_007_r02_c02_在.jpg` - 第2行第2列 "在"字
- `峄山刻石_char_012_r03_c02_王.jpg` - 第3行第2列 "王"字

---

## 📊 字符统计

### 高频字 (出现2次以上)

| 汉字 | 出现次数 | 位置 |
|:---:|:---:|:---|
| □ | 8 | 残缺或模糊字符 |
| 帝 | 3 | r01c02, r01c04, r01c22 |
| 臣 | 3 | r01c25, r01c26, r02c01 |
| 皇 | 2 | r01c01, r01c11 |
| 世 | 2 | r02c04, ... |
| 方 | 2 | r04c05, ... |
| 经 | 2 | r01c19, ... |
| 不 | 2 | 多处 |
| 久 | 2 | r01c06, ... |

---

## 📁 数据结构

### result.json 字段说明

```json
{
  "stele_name": "峄山刻石",
  "script_type": "小篆",
  "total_characters": 142,
  "characters": [
    {
      "index": 1,           // 字符序号
      "char": "皇",         // 汉字
      "original": "皇",     // 原碑字形
      "pinyin": "huáng",    // 拼音
      "definition": "君主，皇帝", // 释义
      "bbox": [16, 78, 28, 13], // 原图坐标 [y, x, height, width]
      "row": 1,             // 行号
      "col": 1,             // 列号
      "sliced_image": "...", // 单字图片路径
      "sliced_bbox": [...]  // 单字图片坐标
    }
  ]
}
```

---

## 🔍 快速查找

### 按汉字查找

使用提供的 Python 脚本 `yishan_keshi_viewer.py`:

```python
from yishan_keshi_viewer import YishanKeshiViewer

viewer = YishanKeshiViewer()

# 查找"皇"字的所有位置
results = viewer.find_character('皇')
for r in results:
    print(f"位置: 第{r['row']}行第{r['col']}列")
    print(f"图片: {r['image_file']}")
```

### 按位置查找

```python
# 获取第1行第1列的字符
char = viewer.get_character_by_position(1, 1)
print(char['char'])  # 输出: 皇
```

### 按序号查找

```python
# 获取第7个字符
char = viewer.get_character_by_index(7)
print(char['char'])  # 输出: 在
```

---

## 📝 标准全文 (222字)

```
皇帝曰金石刻尽始皇帝所为也今袭号而金石刻辞不称始皇帝其于久远也如后嗣为之者不称成功盛德丞相臣斯臣去疾御史大夫臣德昧死言臣请具刻诏书金石刻因明白矣臣昧死请制曰可皇帝立国维初在昔嗣世称王讨伐乱逆威动四极武义直方戎臣奉诏经时不久灭六暴强廿有六年上荐高号孝道显明既献泰成乃降专惠亲巡远方登于绎山群臣从者咸思攸长追念乱世分土建邦以开争理功战日作流血于野自泰古始世无万数陀及五帝莫能禁止乃今皇帝一家天下兵不复起灾害灭除黔首康定利泽长久群臣诵略刻此乐石以著经纪皇帝曰金石刻尽始皇帝所为也今袭号而金石刻辞不称始皇帝其于久远也如后嗣为之者不称成功盛德丞相臣斯臣去疾御史大夫臣德昧死言臣请具刻诏书金石刻因明白矣臣昧死请制曰可
```

---

## 🔗 文件路径汇总

```
inkGrid/
├── steles/1-zhuanshu/1-yishankeshi/
│   ├── yishan.jpg              # 原碑图 (267KB)
│   ├── yishan2.jpg             # 另一版本
│   ├── yishan_segmented.jpg    # 分割图
│   ├── yishan_paddle.jpg       # OCR检测结果
│   └── yishan_paddle_gt.jpg    # 标注真值图
│
├── test_output/峄山刻石/
│   ├── result.json             # 元数据 (142条记录)
│   ├── analysis.json           # 分析结果
│   ├── visualization.jpg       # 可视化图
│   └── 峄山刻石_char_*.jpg     # 143张单字图片
│
└── library_guided_export/
    ├── yishan_keshi_index.json # 资源索引
    ├── yishan_keshi_viewer.py  # 查看器脚本
    └── README_Yishan_Keshi.md  # 本说明文档
```

---

## 💡 使用建议

1. **批量获取单字图片**: 直接访问 `test_output/峄山刻石/` 目录
2. **程序化访问**: 使用 `yishan_keshi_viewer.py` 提供的API
3. **可视化查看**: 打开 `visualization.jpg` 查看带编号标注的完整图
4. **数据对齐**: 使用 `result.json` 中的坐标信息进行精确对齐

---

## ⚠️ 注意事项

- 142个单字图片是自动切分的结果，部分模糊或残缺的字用"□"表示
- 原碑222字中，有80字因图像质量或位置原因未能成功提取
- 所有图片路径都是相对于项目根目录的相对路径

