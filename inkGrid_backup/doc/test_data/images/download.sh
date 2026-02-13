#!/bin/bash

# inkGrid 测试图片批量下载脚本
# 用法: chmod +x download.sh && ./download.sh

echo "========================================="
echo "  inkGrid 测试图片下载脚本"
echo "========================================="
echo ""

# 创建目录
mkdir -p 楷书
mkdir -p 隶书
mkdir -p 篆书

# 计数器
success=0
failed=0

# 下载函数
download_image() {
    local filename=$1
    local url=$2
    local description=$3
    
    echo "[下载] $description -> $filename"
    
    if curl -L -o "$filename" "$url" 2>/dev/null; then
        # 检查文件是否有效
        if [ -s "$filename" ] && file "$filename" | grep -q "image"; then
            echo "  ✅ 成功 ($(du -h "$filename" | cut -f1))"
            ((success++))
        else
            echo "  ❌ 下载失败或文件无效"
            rm -f "$filename"
            ((failed++))
        fi
    else
        echo "  ❌ 下载失败"
        ((failed++))
    fi
}

echo "📁 隶书碑帖..."
echo ""

# 1. 曹全碑 (已验证可用)
download_image \
    "隶书/cao-quan-bei-01.jpg" \
    "https://commons.wikimedia.org/wiki/Special:FilePath/%E6%9B%B9%E5%85%A8%E7%A2%91-%E4%B8%9C%E6%B1%89%E4%B8%AD%E5%B9%B3%E4%BA%8C%E5%B9%B4%EF%BC%88185%EF%BC%89-%E8%A5%BF%E5%AE%89%E7%A2%91%E6%9E%97%E7%AC%AC%E4%B8%89%E5%AE%A4_2023-09-29_01.jpg" \
    "曹全碑 (西安碑林)"

# 2. 张迁碑
download_image \
    "隶书/zhang-qian-bei-01.jpg" \
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/%E5%BC%A0%E8%BF%81%E7%A2%91_%E5%8E%9F%E7%89%88.jpg/800px-%E5%BC%A0%E8%BF%81%E7%A2%91_%E5%8E%9F%E7%89%88.jpg" \
    "张迁碑 (泰安岱庙)"

# 3. 礼器碑
download_image \
    "隶书/li-qi-bei-01.jpg" \
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/%E7%A6%8F%E5%99%A8%E7%89%87_%E5%8E%9F%E7%89%88.jpg/800px-%E7%A6%8F%E5%99%A8%E7%89%87_%E5%8E%9F%E7%89%88.jpg" \
    "礼器碑 (曲阜孔庙)"

echo ""
echo "📁 楷书碑帖..."
echo ""

# 4. 九成宫醴泉铭
download_image \
    "楷书/jiu-cheng-gong-li-quan-ming-01.jpg" \
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/%E4%B9%9D%E6%88%90%E5%AE%AB%E9%86%B4%E6%B3%89%E9%93%AD_%E5%AE%98%E5%8D%97%E5%86%85%E6%9C%AF%E5%AD%A6%E9%99%A2%E8%97%8F%E5%86%99%E6%96%87%E4%BB%93%E5%82%AD%E5%A3%81%E5%86%85%E9%82%89%E5%8F%91%E7%8E%B0%E9%86%B4%E6%B3%89.jpg/1200px-%E4%B9%9D%E6%88%90%E5%AE%AB%E9%86%B4%E6%B3%89%E9%93%AD_%E5%AE%98%E5%8D%97%E5%86%85%E6%9C%AF%E5%AD%A6%E9%99%A2%E8%97%8F%E5%86%99%E6%96%87%E4%BB%93%E5%82%AD%E5%A3%81%E5%86%85%E9%82%89%E5%8F%91%E7%8E%B0%E9%86%B4%E6%B3%89.jpg" \
    "九成宫醴泉铭"

# 5. 多宝塔碑
download_image \
    "楷书/duo-bao-ta-bei-01.jpg" \
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/%E5%A4%9A%E5%AE%9D%E5%A1%94%E6%84%9F%E5%BA%86%E7%A5%A8.jpg/800px-%E5%A4%9A%E5%AE%9D%E5%A1%94%E6%84%9F%E5%BA%86%E7%A5%A8.jpg" \
    "多宝塔碑 (西安碑林)"

# 6. 玄秘塔碑
download_image \
    "楷书/xuan-mi-ta-bei-01.jpg" \
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/%E7%8E%84%E7%A7%98%E5%A1%94%E7%A2%91.jpg/800px-%E7%8E%84%E7%A7%98%E5%A1%94%E7%A2%91.jpg" \
    "玄秘塔碑 (西安碑林)"

echo ""
echo "📁 篆书碑帖..."
echo ""

# 7. 峄山刻石
download_image \
    "篆书/yi-shan-bei-01.jpg" \
    "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/%E5%B3%AF%E5%B1%B1%E5%88%BB%E7%9F%B3_%E8%A5%BF%E5%8D%97%E5%94%90%E5%AF%86%E9%92%88%E6%93%AC%E6%9C%AC.jpg/800px-%E5%B3%AF%E5%B1%B1%E5%88%BB%E7%9F%B3_%E8%A5%BF%E5%8D%97%E5%94%90%E5%AF%86%E9%92%88%E6%93%AC%E6%9C%AC.jpg" \
    "峄山刻石 (西安碑林)"

# 8. 泰山刻石
download_image \
    "篆书/tai-shan-bei-01.jpg" \
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/%E6%B3%B0%E5%B1%B1%E5%88%BB%E7%9F%B3_%E5%8E%9F%E7%89%88.jpg/600px-%E6%B3%B0%E5%B1%B1%E5%88%BB%E7%9F%B3_%E5%8E%9F%E7%89%88.jpg" \
    "泰山刻石 (泰安岱庙)"

echo ""
echo "========================================="
echo "  下载完成!"
echo "========================================="
echo "✅ 成功: $success"
echo "❌ 失败: $failed"
echo ""
echo "已下载的图片保存在:"
echo "  - 隶书/cao-quan-bei-01.jpg"
echo "  - 楷书/jiu-cheng-gong-li-quan-ming-01.jpg"
echo "  - 楷书/duo-bao-ta-bei-01.jpg"
echo "  - 楷书/xuan-mi-ta-bei-01.jpg"
echo "  - 篆书/yi-shan-bei-01.jpg"
echo "  - 篆书/tai-shan-bei-01.jpg"
echo ""
echo "更多高清图片请参考: 图片资源索引.md"
echo ""
