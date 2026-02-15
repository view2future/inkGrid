# 曹全碑 · 碑阳 · 单字切片

本目录由脚本 `scripts/extract_caoquanbei_chars.py` 自动生成。

## 命名规则

每个字一张 PNG：

- `caoquanbei_yang_{index:04d}_U{codepoint}.png`

示例：`caoquanbei_yang_0001_U541B.png` 表示第 1 个字「君」。

## 索引

- `index.json`：每张图对应的字、Unicode、来源图片（`caoquanbei-XXX.jpg`）、以及所在网格 (col,row) 与裁剪框。
- `text.txt`：将本目录所覆盖的碑阳文字按顺序拼接。

## 注意

当前 `steles/2-lishu/1-caoquanbei/` 只有 47 张切片图，完整碑阳应为 849 字；本目录共生成 831 字。

缺失的一段 18 字为：

`同時並動而縣民郭家等復造逆亂燔燒城寺`

若补齐对应的原始切片图，再重新运行脚本即可生成完整 849 字。
