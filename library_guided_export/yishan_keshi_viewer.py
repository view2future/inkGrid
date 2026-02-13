#!/usr/bin/env python3
"""
峄山刻石图片资源查看器
用于快速查找和获取峄山刻石的碑帖图片及单字图片
"""

import json
import os
from pathlib import Path
from typing import List, Dict, Optional, Tuple

class YishanKeshiViewer:
    """峄山刻石图片资源查看器"""
    
    def __init__(self, base_dir: str = ".."):
        self.base_dir = Path(base_dir)
        self.stele_dir = self.base_dir / "steles" / "1-zhuanshu" / "1-yishankeshi"
        self.output_dir = self.base_dir / "test_output" / "峄山刻石"
        self.metadata_file = self.output_dir / "result.json"
        
        # 加载元数据
        self.metadata = self._load_metadata()
        
    def _load_metadata(self) -> Dict:
        """加载字符元数据"""
        if self.metadata_file.exists():
            with open(self.metadata_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}
    
    def get_original_image_path(self) -> str:
        """获取原碑图片路径"""
        return str(self.stele_dir / "yishan.jpg")
    
    def get_all_character_images(self) -> List[str]:
        """获取所有单字图片路径列表"""
        image_files = []
        if self.output_dir.exists():
            for f in sorted(self.output_dir.glob("峄山刻石_char_*.jpg")):
                image_files.append(str(f))
        return image_files
    
    def find_character(self, char: str) -> List[Dict]:
        """查找指定汉字的所有出现位置
        
        Args:
            char: 要查找的汉字
            
        Returns:
            包含该字的所有位置信息列表
        """
        results = []
        characters = self.metadata.get('characters', [])
        
        for c in characters:
            if c['char'] == char:
                results.append({
                    'index': c['index'],
                    'row': c['row'],
                    'col': c['col'],
                    'char': c['char'],
                    'pinyin': c.get('pinyin', ''),
                    'definition': c.get('definition', ''),
                    'image_file': c.get('sliced_image', ''),
                    'bbox': c.get('bbox', []),
                    'original': c.get('original', '')
                })
        
        return results
    
    def get_character_by_position(self, row: int, col: int) -> Optional[Dict]:
        """通过行列位置获取字符信息"""
        characters = self.metadata.get('characters', [])
        for c in characters:
            if c['row'] == row and c['col'] == col:
                return c
        return None
    
    def get_character_by_index(self, index: int) -> Optional[Dict]:
        """通过序号获取字符信息"""
        characters = self.metadata.get('characters', [])
        for c in characters:
            if c['index'] == index:
                return c
        return None
    
    def get_full_text(self) -> str:
        """获取完整文本内容"""
        chars = []
        for c in sorted(self.metadata.get('characters', []), key=lambda x: x['index']):
            chars.append(c['char'])
        return ''.join(chars)
    
    def get_statistics(self) -> Dict:
        """获取统计信息"""
        characters = self.metadata.get('characters', [])
        unique_chars = set(c['char'] for c in characters)
        
        # 统计高频字
        char_count = {}
        for c in characters:
            char = c['char']
            char_count[char] = char_count.get(char, 0) + 1
        
        top_chars = sorted(char_count.items(), key=lambda x: x[1], reverse=True)[:10]
        
        return {
            'total_extracted': len(characters),
            'unique_chars': len(unique_chars),
            'top_chars': top_chars,
            'stele_name': self.metadata.get('stele_name', ''),
            'script_type': self.metadata.get('script_type', '')
        }
    
    def export_character_grid(self) -> List[List[str]]:
        """导出字符网格（按行列组织）"""
        characters = self.metadata.get('characters', [])
        
        # 找出最大行列
        max_row = max(c['row'] for c in characters) if characters else 0
        max_col = max(c['col'] for c in characters) if characters else 0
        
        # 创建网格
        grid = [['' for _ in range(max_col)] for _ in range(max_row)]
        
        for c in characters:
            row_idx = c['row'] - 1  # 转为0-based
            col_idx = c['col'] - 1
            if 0 <= row_idx < max_row and 0 <= col_idx < max_col:
                grid[row_idx][col_idx] = c['char']
        
        return grid
    
    def print_character_grid(self):
        """打印字符网格"""
        grid = self.export_character_grid()
        print("\n=== 峄山刻石 字符排列 ===\n")
        for i, row in enumerate(grid, 1):
            row_str = ' '.join(c if c else '  ' for c in row)
            print(f"第{i:2d}行: {row_str}")


def main():
    """示例用法"""
    viewer = YishanKeshiViewer()
    
    print("=" * 50)
    print("峄山刻石 图片资源查看器")
    print("=" * 50)
    
    # 显示统计信息
    stats = viewer.get_statistics()
    print(f"\n📊 统计信息:")
    print(f"  碑帖名称: {stats['stele_name']}")
    print(f"  书体: {stats['script_type']}")
    print(f"  已提取字数: {stats['total_extracted']}")
    print(f"  不重复字数: {stats['unique_chars']}")
    
    print(f"\n🔝 高频字 (Top 10):")
    for char, count in stats['top_chars']:
        print(f"  \"{char}\": {count}次")
    
    # 显示原图路径
    print(f"\n📷 原碑图片路径:")
    print(f"  {viewer.get_original_image_path()}")
    
    # 显示单字图片数量
    char_images = viewer.get_all_character_images()
    print(f"\n🖼️ 单字图片数量: {len(char_images)}")
    print(f"  存储位置: {viewer.output_dir}")
    
    # 查找示例字
    print(f"\n🔍 查找示例 - \"皇\":")
    results = viewer.find_character('皇')
    for r in results:
        print(f"  位置: 第{r['row']}行第{r['col']}列")
        print(f"  拼音: {r['pinyin']}")
        print(f"  释义: {r['definition']}")
        print(f"  图片: {r['image_file']}")
        print()
    
    # 打印字符网格
    viewer.print_character_grid()


if __name__ == "__main__":
    main()
