#!/bin/bash
# prepush_check.sh — 检查即将推送的文件中是否有 >30MB 的大文件
# 用法：./prepush_check.sh

THRESHOLD=31457280  # 30 MB in bytes
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}🔍 开始预检：即将推送的文件中是否存在 >30MB 大文件？${NC}"

found=0

# 1. 检查暂存区（staging area）中的新/修改文件
echo -e "\n→ 暂存区文件（git add 后未 commit 的）："
git ls-files -o --others --exclude-standard 2>/dev/null | while read f; do
  if [ -f "$f" ] && size=$(stat -f %z "$f" 2>/dev/null); then
    if [ "$size" -gt "$THRESHOLD" ]; then
      mb=$(echo "scale=1; $size/1024/1024" | bc)
      printf "${RED}  ⚠️ %s (%.1f MB)${NC}\n" "$f" "$mb"
      found=$((found + 1))
    fi
  fi
done

# 2. 检查已跟踪且被修改的文件（git diff 中的）
echo -e "\n→ 已跟踪并修改的文件（git diff 显示的）："
git diff --name-only 2>/dev/null | while read f; do
  if [ -f "$f" ] && size=$(stat -f %z "$f" 2>/dev/null); then
    if [ "$size" -gt "$THRESHOLD" ]; then
      mb=$(echo "scale=1; $size/1024/1024" | bc)
      printf "${RED}  ⚠️ %s (%.1f MB)${NC}\n" "$f" "$mb"
      found=$((found + 1))
    fi
  fi
done

# 3. 检查当前 HEAD 中的大文件（防历史 commit 遗留）
echo -e "\n→ 当前 HEAD 提交中的文件："
git ls-tree -r HEAD --long 2>/dev/null | awk -v t="$THRESHOLD" '$4 > t {print $4, $5}' | while read size path; do
  mb=$(echo "scale=1; $size/1024/1024" | bc)
  printf "${RED}  ⚠️ %s (%.1f MB)${NC}\n" "$path" "$mb"
  found=$((found + 1))
done

if [ "$found" -eq 0 ]; then
  echo -e "\n${GREEN}✅ 安全：未发现 >30MB 文件，可以放心 git push${NC}"
else
  echo -e "\n${RED}❌ 检测到 $found 个大文件！请先运行：\n   git rm -r --cached <路径>\n   或使用 fix_push.sh 清理${NC}"
fi