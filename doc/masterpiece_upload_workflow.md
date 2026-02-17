# InkGrid 名帖入库流程（上传为主）

这个流程面向“你提供原帖图片”的扩库方式：先把图片放进 `steles/`，再用脚本更新 `steles.json` 的 `assets` 字段，最后用校验脚本兜底。

## 目录结构约定

- 原帖图片统一放在仓库根目录的 `steles/` 下。
- 五体建议使用：
  - `steles/1-zhuanshu/`（篆书）
  - `steles/2-lishu/`（隶书）
  - `steles/3-kaishu/`（楷书）
  - `steles/4-xingshu/`（行书）
  - `steles/5-caoshu/`（草书）

每一份名帖建议一个独立目录，例如：

- `steles/4-xingshu/xing_001-lantingxu/`
  - `lantingxu-001.jpg`
  - `lantingxu-002.jpg`
  - ...
  - `thumbs/`（可选，自动生成）

## 1) 准备一份名帖的基础信息

在 `frontend/public/data/steles.json` 里准备（或创建）一条记录，至少要有：

- `id`（唯一）
- `name`
- `script_type`（篆书/隶书/楷书/行书/草书）
- `author` / `dynasty` / `location` / `description`

> 你也可以不手写，直接用下面的导入脚本自动创建。

## 2) 导入原帖页图并生成缩略图

把你上传的页图放在任意目录（文件名不重要），然后运行：

```bash
python3 scripts/masterpiece_import_assets.py \
  --id xing_001 \
  --slug lantingxu \
  --script-type 行书 \
  --name 兰亭序 \
  --author 王羲之 \
  --dynasty 东晋 \
  --type 墨迹 \
  --location 故宫博物院（神龙本） \
  --description "行书第一，飘若浮云、矫若惊龙。" \
  --source-pages "/你的/上传目录"
```

脚本会做三件事：

1) 把页图复制/重命名到：`steles/<书体目录>/<id>-<slug>/`
2) 生成缩略图到：`steles/<...>/thumbs/`
3) 更新 `frontend/public/data/steles.json` 对应条目的：
   - `assets.cover`
   - `assets.pages`（pattern + start/end + pad）
   - `assets.pagesThumb`（缩略图 pattern）

## 3) 校验（强烈建议每次入库都跑）

```bash
python3 scripts/catalog_validate.py
```

它会提示：

- 重复 `id`
- 缺失 knowledge（如果没有知识库条目）
- 缺失 assets（没有 cover/pages）
- assets 指向的文件是否存在

## 4) 构建前端

```bash
cd frontend
npm run build
```

## 备注：为什么要加 `assets`

名帖学习卡需要稳定地知道：

- 封面用哪张图（`assets.cover`）
- 有多少页（`assets.pages`）
- 缩略预览用哪套图（`assets.pagesThumb`）

这样你后续把 79 扩到 500 时，不用改前端逻辑，只要“持续入库 + 校验”。
