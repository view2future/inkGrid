#!/usr/bin/env python3
"""
颜勤礼碑图片资源查看器
用于管理和查看颜勤礼碑的碑帖图片及单字图片

使用方法:
    python3 yanqinli_viewer.py
"""

import json
import os
from pathlib import Path
from typing import List, Dict, Optional, Tuple

class YanQinLiViewer:
    """颜勤礼碑图片资源查看器"""
    
    def __init__(self, base_dir: str = ".."):
        self.base_dir = Path(base_dir)
        self.stele_dir = self.base_dir / "steles" / "3-kaishu" / "2-yanqinli"
        self.output_dir = self.base_dir / "test_output" / "颜勤礼碑"
        self.index_file = Path(__file__).parent / "yanqinli_index.json"
        
        # 加载索引
        self.index = self._load_index()
        
        # 检查资源状态
        self.resource_status = self._check_resources()
        
    def _load_index(self) -> Dict:
        """加载资源索引"""
        if self.index_file.exists():
            with open(self.index_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}
    
    def _check_resources(self) -> Dict:
        """检查资源状态"""
        status = {
            "original_image": False,
            "processed_images": False,
            "character_images": 0,
            "metadata": False
        }
        
        # 检查原图
        if self.stele_dir.exists():
            for ext in ['.jpg', '.jpeg', '.png', '.tif']:
                if list(self.stele_dir.glob(f"*{ext}")):
                    status["original_image"] = True
                    break
        
        # 检查处理后图片
        if self.output_dir.exists():
            char_images = list(self.output_dir.glob("颜勤礼碑_char_*.jpg"))
            status["character_images"] = len(char_images)
            status["processed_images"] = len(char_images) > 0
            
            # 检查元数据
            metadata_file = self.output_dir / "result.json"
            status["metadata"] = metadata_file.exists()
        
        return status
    
    def get_resource_status(self) -> Dict:
        """获取资源状态报告"""
        return {
            "stele_name": "颜勤礼碑",
            "status": "完整" if self.resource_status["character_images"] > 1000 else "待获取",
            "original_image": "✅ 已存在" if self.resource_status["original_image"] else "❌ 待下载",
            "character_images": f"{self.resource_status['character_images']} / ~1667",
            "metadata": "✅ 已存在" if self.resource_status["metadata"] else "❌ 待生成",
            "steles_dir": str(self.stele_dir),
            "output_dir": str(self.output_dir),
        }
    
    def get_original_image_path(self) -> Optional[str]:
        """获取原碑图片路径"""
        if not self.stele_dir.exists():
            return None
        
        for ext in ['.jpg', '.jpeg', '.png', '.tif']:
            files = list(self.stele_dir.glob(f"*{ext}"))
            if files:
                return str(files[0])
        return None
    
    def get_all_character_images(self) -> List[str]:
        """获取所有单字图片路径列表"""
        if not self.output_dir.exists():
            return []
        
        image_files = []
        for f in sorted(self.output_dir.glob("颜勤礼碑_char_*.jpg")):
            image_files.append(str(f))
        return image_files
    
    def find_character(self, char: str) -> List[Dict]:
        """查找指定汉字的所有出现位置
        
        如果元数据存在，则从文件读取；否则从索引估算
        """
        results = []
        
        # 尝试从元数据读取
        metadata_file = self.output_dir / "result.json"
        if metadata_file.exists():
            with open(metadata_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for c in data.get('characters', []):
                    if c['char'] == char:
                        results.append({
                            'index': c['index'],
                            'row': c['row'],
                            'col': c['col'],
                            'char': c['char'],
                            'pinyin': c.get('pinyin', ''),
                            'definition': c.get('definition', ''),
                            'image_file': c.get('sliced_image', ''),
                            'bbox': c.get('bbox', [])
                        })
        
        return results
    
    def get_download_guide(self) -> str:
        """获取下载指南"""
        guide = """
📥 颜勤礼碑资源获取指南

【推荐资源】
网站: 书格网 (https://old.shuge.org/ebook/yan-qinli-bei/)
内容: 故宫博物院藏民国时期拓本
格式: PDF (169MB) + JPG 拓片七幅

【下载步骤】
1. 访问上述链接
2. 找到下载区域
3. 下载 JPG 拓片或 PDF
4. 将文件保存到:
   {steles_dir}/

【建议文件名】
- yanqinli_full.jpg (整碑拓片)
- yanqinli_yang.jpg (碑阳)
- yanqinli_yin.jpg (碑阴)
- yanqinli_ce.jpg (碑侧)

【处理命令】
下载完成后，运行:
  cd processor && python3 process_stele.py --stele "颜勤礼碑" --input "../{steles_dir}/yanqinli_full.jpg"
""".format(steles_dir=self.stele_dir.relative_to(self.base_dir))
        return guide
    
    def get_full_text(self) -> str:
        """获取完整文本内容"""
        # 从系统元数据读取
        steles_json = self.base_dir / "processor" / "data" / "steles.json"
        if steles_json.exists():
            with open(steles_json, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for stele in data.get('steles', []):
                    if stele['name'] == '颜勤礼碑':
                        return stele.get('content', '')
        return ''
    
    def print_info(self):
        """打印详细信息"""
        print("=" * 60)
        print("  颜勤礼碑 图片资源查看器")
        print("=" * 60)
        
        # 资源状态
        status = self.get_resource_status()
        print("\n📊 资源状态:")
        print(f"  碑帖名称: {status['stele_name']}")
        print(f"  整体状态: {status['status']}")
        print(f"  原碑图片: {status['original_image']}")
        print(f"  单字图片: {status['character_images']}")
        print(f"  元数据:   {status['metadata']}")
        
        # 路径信息
        print("\n📁 目录路径:")
        print(f"  原图存储: {status['steles_dir']}")
        print(f"  输出目录: {status['output_dir']}")
        
        # 如果资源不完整，显示下载指南
        if not self.resource_status["original_image"]:
            print(self.get_download_guide())
        
        # 全文预览
        text = self.get_full_text()
        if text:
            print("\n📝 全文预览 (前200字):")
            print(f"  {text[:200]}...")
            print(f"\n  总字数: {len(text)} 字")
        
        # 如果有单字图片，显示示例
        char_images = self.get_all_character_images()
        if char_images:
            print(f"\n🖼️ 单字图片示例:")
            for img in char_images[:5]:
                print(f"  - {Path(img).name}")
            if len(char_images) > 5:
                print(f"  ... 共 {len(char_images)} 张")
        
        print("\n" + "=" * 60)


def main():
    """主函数"""
    viewer = YanQinLiViewer()
    viewer.print_info()
    
    # 交互式查询（如果资源存在）
    char_images = viewer.get_all_character_images()
    if char_images:
        print("\n🔍 输入汉字查询（或按Enter退出）:")
        while True:
            char = input("> ").strip()
            if not char:
                break
            if len(char) != 1:
                print("请输入单个汉字")
                continue
            
            results = viewer.find_character(char)
            if results:
                print(f"找到 {len(results)} 处:")
                for r in results[:5]:  # 只显示前5个
                    print(f"  第{r['row']}行第{r['col']}列: {r['image_file']}")
            else:
                print(f"未找到 \"{char}\"")


if __name__ == "__main__":
    main()
